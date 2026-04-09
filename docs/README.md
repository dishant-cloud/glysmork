# Glysmork Documentation

Welcome to the internal engineering documentation for **Glysmork**. 

This system represents a distributed, Next.js plus Python/Django AI-centered communication stack built to power intent-driven matchmaking using NLP and continuous vector analysis.

## Core Documentation Files

*   **[01 System Architecture](./01_system_architecture.md)** 
    High-level outline of caching mechanisms, the Next.js/FastAPI/Django separation, and how data traverses the cloud loop.
*   **[02 User Flow](./02_user_flow.md)** 
    Breakdown of the lifecycle sequence from psychometric induction mappings to creating WebRTC video streams.
*   **[03 Matchmaking Engine](./03_matchmaking_engine.md)**
    Detailed instructions explaining the Hybrid Boolean AST (Abstract Syntax Tree) system, the Onboarding Base compatibility score pipeline, and Vector extraction math.
*   **[04 Database Schema](./04_database_schema.md)**
    Breakdown of critical Django application SQL tables underpinning Vector embeddings and psychological telemetry.

## System Objectives
The core priority of Glysmork is scaling the **Numpy Math Fallback Engine** (`engine.py`) efficiently over massive local pools of users while maintaining native latency.

Any changes to prompt mappings, models (`Profile.interests_embedding`), or ASGI WebSockets must strictly adhere to the guidelines set in the documentation arrays above.
