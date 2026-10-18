# Project Charter: Interlude Music App

## 1. Project Purpose and Objectives
Interlude is a social music platform that enables listeners to discover music, listen together in real time, and interact through shared listening rooms and chat. It also provides musicians with profiles and an analytics dashboard to understand how their music is being listened to. The project aims to combine music discovery, community interaction, and artist-facing insights in one application.

The core objective is to deliver a functional music platform with user authentication, a music catalogue, shared listening rooms, real-time communication, and basic musician analytics. An AI-powered chatbot or music-discovery assistant is an optional  goal and will only be considered after the core requirements are completed.

## 2. Stakeholders & Roles
* **Product Owner:** Şevval Tüfekçi
* **Software Engineering Team:** 
    * Şevval Tüfekçi : Project planning, weekly meetings, risk tracking, song and album catalogue, metadata, media upload and storage integration, search/listing and streaming APIs, homepage, catalogue/search pages, and music-player interfaces.
    * Lara Doğan : Repository setup, branch strategy and protection, cloud service, CI/CD, deployment, releases, GitHub Projects, and the shared frontend foundation (layout and routing).
    * Sudenaz Hasret : Requirements specification and analysis, customer meeting notes
    and request tracking, documentation review, authentication, role-based access control, user/musician profiles, and the login, registration, and profile interfaces. 
    * Kağan Temur : WebSocket communication, listening rooms, participant presence and chat, room/chat interfaces, test specification, test-first coordination, and test-coverage tracking. All team members remain responsible for testing their own modules.
    * Efe Arda Demir : Listening-event collection, analytics APIs and metrics, and an equal share of the
    frontend UI work with Ahmet Taha Angın. Implements the musician dashboard
    and data visualizations, and leads the technical implementation of
    agreed statistical analysis. Collaborates on evaluating an optional
    AI feature if time permits.
    * Ahmet Taha Angın : Coordinates project documentation and
    reviews the Design Specification and technical documentation for
    consistency. Shares frontend UI implementation equally with Efe Arda Demir, focusing on agreed
    pages/components and integration. Takes responsibility for native mobile application development, including selected core features and backend API integration.Collaborates with Efe Arda Demir on
    statistical analysis and optional AI-related work, including use-case
    evaluation, output quality, limitations, privacy, and risk
    documentation.
* **GH Repo/Project URL:** https://github.com/itu-itis26-doganl25/Interlude-App.git

### Shared working agreements

-   Each developer owns the implementation and tests for their assigned
    backend or technical module.
-   Each developer documents their module. Member 6 (Ahmet Taha Angın) coordinates
    documentation consistency and review.
-   Member 2 (Lara Doğan) coordinates technical integration, CI/CD, and releases,
    Member 1 (Şevval Tüfekçi) coordinates overall project progress.


## 3. Project Scope
### Project domain
Interlude belongs to the music streaming and social-listening domain.
Its intended users are listeners who want to discover music and listen
together, as well as musicians who want to share their work and view
basic statistics. Potential customers include independent
musicians and communities of music listeners. The project is a
team software-engineering application, any production-scale
commercial service is outside the current commitment.
### In-Scope 

-   User registration, login, authentication, authorization, and
    role-based access control.
-   User and musician profiles.
-   Music catalogue with song and album metadata.
-   Media upload and storage integration.
-   Search and browsing of songs/albums and a basic
    music-player/streaming interface.
-   Shared listening rooms and room participance.
-   Real-time participant presence and text chat using WebSocket.
-   Collection of basic listening events and analytics.
-   Musician dashboard showing basic statistics such as play counts and
    popular tracks.
-   Frontend pages for authentication, profiles, catalogue, player,
    listening rooms, chat, and the musician dashboard.
-   Automated tests, test coverage reporting, technical documentation,
    CI/CD, and a demonstrable deployment or agreed demo environment.
-   Requirements management, issue tracking, and release management.
-   Native mobile application with selected core features.

### Out-of-Scope 

-   A production-grade global music-streaming service or commercial
    licensing agreements.
-   Payment processing, subscriptions, advertising, royalties, or artist
    payouts.
-   Advanced recommendation models, model training, or a full AI
    recommendation engine.
-   Guaranteed production-scale availability, large-scale load handling,
    or enterprise-grade security certification.
-   Uploading or distributing copyrighted music without appropriate
    permission.
    
## 4. Technology Stack
### Backend Stack

-   Python with Django framework.
-   REST APIs for core application features.
-   WebSocket for chat features.
-   WebRTC for low-latency audio stream services.
-   Django ORM for relational data. 
-   A file-storage solution for uploaded media, to be selected by the
    team.
-   Automated backend testing with the testing framework supported by
    the selected backend stack.
-   Microsoft Azure will be used as the cloud platform for hosting, deployment, and file storage.

### Frontend Stack
-   React with TypeScript.
-   HTML and CSS for application structure and styling.
-   A client-side routing library compatible with React.
-   A charting library for musician analytics visualizations, to be
    selected by the team.
-   WebSocket and WebRTC client integration for real-time room and chat updates.
-   AI-assisted development tools may be used to support mobile application development. Its implementation framework and target platform to be determined during the design phase.

### AI Stack

-   Claude Code and ChatGPT will be used as an AI-assisted development tool.
-   No AI component is required for the core release.
-   Optional stretch goal: integrate an existing AI API for a small
    chatbot or music-discovery assistant, subject to time, cost,
    privacy, and risk review.
-   If the optional feature is attempted, the team will document its
    purpose, usage, limitations, review effort, and observed error
    types.
-   No custom model training is planned for the core project.

## 5. Project Milestones
| Deliverable                       | Deadline          |
|---                                |---                |
| Project Charter                   | 05.10.2026 23:59  |
| Project Plan                      | 19.10.2026 23:59  |
| Requirement Specification Report  | 02.11.2026 23:59  |
| Requirement Analysis Report       | 23.11.2026 23:59  |
| Software Design Report            | 07.12.2026 23:59  |
| Software Test Report              | 21.12.2026 23:59  |
| Codebase                          | 25.12.2026 23:59  |
| Demo                              | 26.12.2026 23:59  |
| Presentation                      | 28.12.2026 23:59  |
	
	
	
	
	
	
	
	
