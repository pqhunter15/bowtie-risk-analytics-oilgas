import streamlit as st
from pathlib import Path
from src.app.utils import load_data

# Configuration
st.set_page_config(page_title="Bowtie Risk Analytics", layout="wide")
BASE_DIR = Path(__file__).resolve().parent.parent.parent
PROCESSED_DIR = BASE_DIR / "data" / "processed"

def main():
    st.title("🛡️ Bowtie Risk Analytics")

    # Load Data
    with st.spinner("Loading data..."):
        incidents, metrics = load_data(PROCESSED_DIR)

    st.sidebar.success(f"Loaded {len(incidents)} incidents")

    # KPIs
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Total Incidents", metrics.get("total_incidents", 0))
    col2.metric("Avg Prevention", f"{metrics.get('average_prevention_coverage', 0):.1%}")
    col3.metric("Avg Mitigation", f"{metrics.get('average_mitigation_coverage', 0):.1%}")
    col4.metric("Overall Coverage", f"{metrics.get('average_overall_coverage', 0):.1%}")

    st.divider()

if __name__ == "__main__":
    main()
