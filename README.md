# Interlude Music App

**Nova · BLG 411E Software Engineering · Istanbul Technical University**  
**Status:** In development

Interlude is a social music platform for discovering and playing music, listening together in real time, and connecting with other listeners. Musicians can share tracks and view basic listening statistics.

## Planned Features

- Authentication, role-based access, and listener/musician profiles
- Song and album catalogue, media upload, search, and playback
- Shared listening rooms with synchronized playback, presence, and chat
- Listening analytics and a musician dashboard
- Native mobile app with selected features: login, search, and playback
- **Optional:** AI-powered music-discovery assistant, after core features are complete

## Technology Stack

| Area | Technologies |
| --- | --- |
| Backend | Python, Django, Django ORM, REST APIs |
| Web frontend | React, TypeScript |
| Real-time | WebSocket, WebRTC |
| Cloud and media storage | Microsoft Azure |
| Mobile | Framework to be selected (React Native is under consideration) |
| AI-assisted development | Claude Code, ChatGPT; generated work is reviewed and tested |

## Team

| Member | Development role | Management role |
| --- | --- | --- |
| Şevval Tüfekçi | Catalogue, media, streaming, player UI | Product Owner & project coordination |
| Lara Doğan | Frontend foundation, cloud and integration | Repository, CI/CD & release management |
| Sudenaz Hasret | Authentication, RBAC and profiles | Requirements & customer-request coordination |
| M. Kağan Temur | Listening rooms, chat and synchronized playback | Testing & coverage coordination |
| Efe Arda Demir | Analytics, dashboard and frontend UI | Statistical-analysis coordination |
| Ahmet Taha Angın | Native mobile app and shared frontend UI | Documentation & design-review coordination |

## Repository Structure

```text
Interlude-App/
├── src/
│   ├── backend/       # Django application
│   └── frontend/      # React + TypeScript web application
├── tests/             # Automated tests
├── docs/              # Project documentation
└── README.md
```

The mobile application will receive its own source directory after its framework is selected. Initial directories may contain `.gitkeep` placeholders.

## Workflow

We use GitHub Issues and Projects for task tracking, feature branches and reviewed Pull Requests for changes, and branch-targeted GitHub Releases for course document submissions. All team members test and document their own modules; AI-generated contributions are reviewed before merging.

**Repository:** [Interlude-App](https://github.com/itu-itis26-doganl25/Interlude-App)
