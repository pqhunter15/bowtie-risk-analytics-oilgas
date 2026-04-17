"""One-shot retrain from existing feature_matrix.parquet (17-feature schema).

Drops source_agency and label_multiclass, trains Models 1 and 2 with GroupKFold CV,
saves xgb_model{1,2}.json and shap_background_model{1,2}.npy.
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score, matthews_corrcoef, precision_score, recall_score
from sklearn.model_selection import GroupKFold
from xgboost import XGBClassifier

ARTIFACTS = Path("data/models/artifacts")
PARQUET = ARTIFACTS / "feature_matrix.parquet"
FEATURE_NAMES = ARTIFACTS / "feature_names.json"
ENCODER = ARTIFACTS / "encoder.joblib"

TARGETS = {
    "model1": "label_barrier_failed",
    "model2": "label_barrier_failed_human",
}
SHAP_BG_SIZE = 200

def main() -> None:
    df = pd.read_parquet(PARQUET)
    print(f"Loaded parquet: {len(df)} rows, {len(df.columns)} columns")

    for col in ("source_agency", "label_multiclass"):
        if col in df.columns:
            df = df.drop(columns=[col])
            print(f"Dropped {col}")

    with open(FEATURE_NAMES) as f:
        feature_entries = json.load(f)
    feature_cols = [e["name"] for e in feature_entries]
    assert len(feature_cols) == 17, f"expected 17 features, got {len(feature_cols)}"
    print(f"feature_names.json: {len(feature_cols)} features (source_agency absent)")

    enc = joblib.load(ENCODER)
    enc_cats = list(enc.feature_names_in_)
    assert enc_cats == ["side", "barrier_type", "line_of_defense", "barrier_family", "primary_threat_category"], \
        f"encoder features mismatch: {enc_cats}"
    print(f"encoder.joblib: {len(enc_cats)} categoricals, fitted on strings — preserved as-is")

    X = df[feature_cols].to_numpy(dtype=float)
    groups = df["incident_id"].to_numpy()
    print(f"X shape: {X.shape}, groups: {len(set(groups))} unique incidents")

    summary = {}
    for suffix, target_col in TARGETS.items():
        print(f"\n=== {suffix}: {target_col} ===")
        y = df[target_col].to_numpy()
        n_pos, n_neg = int(y.sum()), int((y == 0).sum())
        print(f"  {n_pos} positive ({100*n_pos/len(y):.1f}%), {n_neg} negative")
        spw = n_neg / n_pos if n_pos > 0 else 1.0

        gkf = GroupKFold(n_splits=5)
        splits = list(gkf.split(X, y, groups))

        xgb_metrics, lr_metrics = [], []
        for fold, (tr, te) in enumerate(splits, 1):
            lr = LogisticRegression(class_weight="balanced", solver="lbfgs", max_iter=1000, C=1.0, random_state=42)
            lr.fit(X[tr], y[tr])
            lr_pred = lr.predict(X[te])
            lr_metrics.append({
                "f1": f1_score(y[te], lr_pred, pos_label=1, zero_division=0),
                "mcc": matthews_corrcoef(y[te], lr_pred),
                "precision": precision_score(y[te], lr_pred, pos_label=1, zero_division=0),
                "recall": recall_score(y[te], lr_pred, pos_label=1, zero_division=0),
            })

            xgb = XGBClassifier(
                n_estimators=300, max_depth=4, learning_rate=0.05,
                subsample=0.8, colsample_bytree=0.8,
                scale_pos_weight=spw, eval_metric="logloss",
                tree_method="hist", random_state=42, n_jobs=-1,
            )
            xgb.fit(X[tr], y[tr])
            xgb_pred = xgb.predict(X[te])
            xgb_metrics.append({
                "f1": f1_score(y[te], xgb_pred, pos_label=1, zero_division=0),
                "mcc": matthews_corrcoef(y[te], xgb_pred),
                "precision": precision_score(y[te], xgb_pred, pos_label=1, zero_division=0),
                "recall": recall_score(y[te], xgb_pred, pos_label=1, zero_division=0),
            })
            print(f"  fold {fold}: LR F1={lr_metrics[-1]['f1']:.3f}  XGB F1={xgb_metrics[-1]['f1']:.3f}")

        def agg(rows: list[dict[str, float]]) -> dict[str, tuple[float, float]]:
            return {k: (float(np.mean([r[k] for r in rows])), float(np.std([r[k] for r in rows]))) for k in rows[0]}

        lr_agg, xgb_agg = agg(lr_metrics), agg(xgb_metrics)
        print(f"  LR  CV  : F1={lr_agg['f1'][0]:.3f}±{lr_agg['f1'][1]:.3f}  MCC={lr_agg['mcc'][0]:.3f}")
        print(f"  XGB CV  : F1={xgb_agg['f1'][0]:.3f}±{xgb_agg['f1'][1]:.3f}  MCC={xgb_agg['mcc'][0]:.3f}")

        lr_full = LogisticRegression(class_weight="balanced", solver="lbfgs", max_iter=1000, C=1.0, random_state=42)
        lr_full.fit(X, y)
        joblib.dump(lr_full, ARTIFACTS / f"logreg_{suffix}.joblib")

        xgb_full = XGBClassifier(
            n_estimators=300, max_depth=4, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8,
            scale_pos_weight=spw, eval_metric="logloss",
            tree_method="hist", random_state=42, n_jobs=-1,
        )
        xgb_full.fit(X, y)
        xgb_path = ARTIFACTS / f"xgb_{suffix}.json"
        xgb_full.save_model(str(xgb_path))
        print(f"  saved: {xgb_path} (n_features_in_={xgb_full.n_features_in_})")

        rng = np.random.default_rng(42)
        bg_n = min(SHAP_BG_SIZE, len(X))
        bg_idx = rng.choice(len(X), size=bg_n, replace=False)
        background = X[bg_idx]
        bg_path = ARTIFACTS / f"shap_background_{suffix}.npy"
        np.save(bg_path, background)
        explainer = shap.TreeExplainer(xgb_full, data=background)
        ev = explainer.expected_value
        print(f"  shap background: {bg_path} shape={background.shape}  expected_value={float(ev):.4f}")

        summary[suffix] = {
            "target": target_col,
            "n_positive": n_pos,
            "xgb_cv_f1": xgb_agg["f1"],
            "xgb_cv_mcc": xgb_agg["mcc"],
            "logreg_cv_f1": lr_agg["f1"],
            "n_features": xgb_full.n_features_in_,
        }

    print("\n=== FINAL F1 SCORES (5-fold GroupKFold CV, minority class) ===")
    for suffix, s in summary.items():
        print(f"  {suffix} ({s['target']}):")
        print(f"    XGBoost F1 = {s['xgb_cv_f1'][0]:.3f} ± {s['xgb_cv_f1'][1]:.3f}  MCC = {s['xgb_cv_mcc'][0]:.3f}")
        print(f"    LogReg  F1 = {s['logreg_cv_f1'][0]:.3f} ± {s['logreg_cv_f1'][1]:.3f}")
        print(f"    n_features_in_ = {s['n_features']}")

if __name__ == "__main__":
    main()
