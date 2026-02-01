# Architecture Decisions

## Overview
This document records key architecture and design decisions for the Bowtie Risk Analytics project.

---

## Decisions

### ADR-001: Use Pydantic for Data Models
**Date:** Project initialization
**Status:** Accepted

**Context:**
Need a robust way to validate and serialize incident data.

**Decision:**
Use Pydantic v2 for all data models.

**Consequences:**
- Strong type validation at runtime
- Easy JSON serialization/deserialization
- Integration with FastAPI if needed later

---

### ADR-002: Use Streamlit for UI
**Date:** Project initialization
**Status:** Accepted

**Context:**
Need a quick way to build interactive data visualization UI.

**Decision:**
Use Streamlit for the main application interface.

**Consequences:**
- Rapid prototyping capability
- Limited customization compared to full web frameworks
- Simple deployment options

---

*Add new decisions above this line*
