# Interlude Music App

**BLG 411E — Software Engineering | Istanbul Technical University**  
**Status:** In development

Interlude is a social music platform that combines music discovery, real-time shared listening, and community interaction. Listeners can explore music and connect through listening rooms and chat, while musicians can view basic analytics about their tracks.

## Planned Features

- User authentication, role-based access, and listener/musician profiles
- Song and album catalogue, search, media upload, and music playback
- Shared listening rooms, participant presence, and real-time chat
- Listening statistics and a musician analytics dashboard
- A **basic native mobile application**, with its target platform and initial features to be defined during design

An AI-powered chatbot or music-discovery assistant is **optional** and will only be considered after the core features are completed.

## Technology Stack

| Area | Technologies |
| --- | --- |
| Backend | Python, Django, Django ORM, REST APIs |
| Real-time communication | WebSocket, WebRTC |
| Frontend | React, TypeScript, HTML, CSS |
| Cloud and storage | Microsoft Azure; media storage integration |
| Native mobile | Platform and implementation approach to be selected |
| AI-assisted development | Claude Code and ChatGPT (GPT models) |

## Team

| Member | Development Responsibilities | Management Responsibilities |
| --- | --- | --- |
| **Şevval Tüfekçi** | Music catalogue, streaming APIs, homepage and player UI | Product Owner; planning, meetings, and risk tracking |
| **Lara Doğan** | Frontend foundation, cloud infrastructure and integration | Repository, GitHub Projects, CI/CD, deployment and releases |
| **Sudenaz Hasret** | Authentication, role-based access, and profiles | Requirements, customer requests, and documentation review |
| **Kağan Temur** | Listening rooms, WebSocket presence/chat and related UI | Test specification and coverage coordination |
| **Efe Arda Demir** | Listening analytics, dashboard and shared frontend UI | Statistical analysis implementation coordination |
| **Ahmet Taha Angın** | Shared frontend UI, integration and optional AI evaluation | Documentation consistency and design review |

Every member is responsible for implementing, documenting, and testing their assigned work.

## Repository Structure

```text
Interlude-App/
├── src/
│   ├── backend/      # Django backend and REST APIs
│   └── frontend/     # React + TypeScript frontend
├── tests/            # Automated tests
├── docs/             # Project documentation
└── README.md
```

The folders are currently initialized with `.gitkeep` placeholders. Application code, tests, and documentation will be added as development progresses. The native mobile application's framework and location in the repository will be decided during design.

## Collaboration and Workflow

- Develop on separate branches and submit changes to `main` through reviewed Pull Requests.
- Submit document deliverables through GitHub Releases targeting their respective document branches.
- Track tasks using GitHub Issues and Projects, including customer requests labeled `customer-requests`.

For the full scope, milestone dates, and responsibilities, see the [Project Charter](docs/Charter.md) once it is added to `docs/`.

**Repository:** [Interlude-App](https://github.com/itu-itis26-doganl25/Interlude-App)
