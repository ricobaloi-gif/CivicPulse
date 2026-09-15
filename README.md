# CivicPulse

<div align="center">

![CivicPulse](public/vercel.svg)

**A multi-tenant civic issue reporting and management platform for municipalities, NGOs, and community organisations.**

[![Next.js](https://img.shields.io/badge/Next.js-16.3.4-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.8-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-12.18.0-FFCA28?style=for-the-badge&logo=firebase)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-5.0-6E9F18?style=for-the-badge&logo=vitest)](https://vitest.dev/)

</div>

---

## 📋 Overview

CivicPulse is a full-stack civic engagement platform that enables communities to report, track, and resolve local issues collaboratively. Built with a **multi-tenant architecture**, it serves municipalities, NGOs, universities, estates, and community organisations—each with isolated data, custom branding, and role-based access control.

### Key Features

| Category | Features |
|----------|----------|
| **Reporting** | Geo-located reports with photos, categories, severity levels, duplicate detection |
| **Workflow** | Status transitions (Submitted → Acknowledged → Assigned → In Progress → Resolved), escalation, SLA tracking |
| **Moderation** | Admin tools for spam/fake/offensive content with audit trail |
| **Disputes** | Residents can dispute resolutions; admins review and reopen or reject |
| **Evidence** | Before/after photos, resolution notes, timestamps |
| **Analytics** | Real-time dashboards: status/severity/category breakdowns, staff workload, SLA metrics |
| **Audit Log** | Immutable logs of all security-sensitive actions |
| **API** | Organisation-scoped REST API with API key management |
| **Notifications** | In-app notifications for status changes, assignments, comments, disputes |
| **Maps** | Interactive MapLibre GL map with draggable pins |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CivicPulse                                │
├─────────────────────────────────────────────────────────────────┤
│  Next.js 16 (App Router)                                        │
│  ├── Client Components (React 19)                               │
│  ├── Server Components & Route Handlers                         │
│  └── Middleware (Auth, Rate Limiting)                           │
├─────────────────────────────────────────────────────────────────┤
│  Firebase (Backend)                                             │
│  ├── Authentication (Email/Password, OAuth)                     │
│  ├── Firestore (Multi-tenant Data)                              │
│  ├── Storage (Images via Cloudinary)                            │
│  └── Cloud Functions (Admin SDK)                                │
├─────────────────────────────────────────────────────────────────┤
│  Shared Libraries                                               │
│  ├── Types, Constants, Auth Helpers                             │
│  ├── Trust Score, Escalation, Notifications                     │
│  └── Audit Log, Rate Limiting, Invitations                      │
└─────────────────────────────────────────────────────────────────┘
```

### Multi-Tenant Model

Every **Organisation** is a logical tenant with:
- **Data Isolation**: All Firestore queries scoped by `organizationId`
- **Custom Branding**: Logo, colours, contact info
- **SLA Targets**: Configurable acknowledgement/resolution hours
- **Subscription Plans**: Pilot → Starter → Professional → Enterprise
- **Member Management**: Role-based invitations (Owner, Admin, Manager, Staff, Viewer, Member)

### Role-Based Access Control

| Role | Platform | Organisation | Reports | Moderation | Analytics | Members |
|------|----------|--------------|---------|------------|-----------|---------|
| **Platform Admin** | ✅ | ✅ | All | ✅ | ✅ | ✅ |
| **Org Owner** | | ✅ | All | ✅ | ✅ | ✅ |
| **Org Admin** | | ✅ | All | ✅ | ✅ | ✅ |
| **Manager** | | ✅ | All | ✅ | ✅ | ❌ |
| **Staff** | | | Assigned only | ❌ | ❌ | ❌ |
| **Resident** | | | Own + Browse | ❌ | ❌ | ❌ |

**Key Security Principles:**
- Residents cannot modify moderation, dispute, or SLA fields
- Staff can only manage reports assigned to them
- All admin actions create immutable audit log entries
- API keys scoped to organisation with granular permissions

---

## 🔌 API Overview

### Authentication
- **Client**: Firebase Auth (email/password, Google OAuth)
- **Server-to-Server**: API Keys (`cp_live_...`) with SHA-256 hashing
- **Permissions**: `reports:read`, `reports:write`, `areas:read`, `analytics:read`

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/reports` | List reports (filtered, paginated) |
| `POST` | `/api/reports` | Create new report |
| `GET` | `/api/reports/:id` | Get report details |
| `PATCH` | `/api/reports/:id` | Update report (status, assignment, moderation, dispute, resolution) |
| `GET` | `/api/analytics` | Organisation analytics dashboard data |
| `GET` | `/api/areas` | List service areas/wards |
| `GET/POST` | `/api/admin/api-keys` | Manage API keys |

### Example: Create Report
```bash
curl -X POST https://your-domain.com/api/reports \
  -H "Authorization: Bearer cp_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Pothole on Main Street",
    "description": "Large pothole causing vehicle damage",
    "category": "Pothole",
    "severity": "high",
    "latitude": -26.2041,
    "longitude": 28.0473
  }'
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16.3.4 (App Router, Turbopack) |
| **Language** | TypeScript 5 (strict mode) |
| **UI** | React 19, Tailwind CSS 4, Lucide Icons |
| **Maps** | MapLibre GL (OpenStreetMap) |
| **Charts** | Recharts |
| **Auth** | Firebase Auth (Client + Admin SDK) |
| **Database** | Cloud Firestore (Real-time listeners) |
| **Storage** | Cloudinary (Image upload/CDN) |
| **Testing** | Vitest (Node environment) |
| **Linting** | ESLint 9 (Next.js config) |
| **CI/CD** | GitHub Actions |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- Firebase project (Auth + Firestore)
- Cloudinary account (for image uploads)

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/civicpulse.git
cd civicpulse

# Install dependencies
npm ci --legacy-peer-deps

# Copy environment template
cp .env.example .env.local
# Edit .env.local with your credentials
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API Key | ✅ |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | ✅ |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Project ID | ✅ |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket | ✅ |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID | ✅ |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase App ID | ✅ |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary Cloud Name | ✅ |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Cloudinary Upload Preset | ✅ |
| `FIREBASE_ADMIN_PROJECT_ID` | Firebase Admin Project ID | ✅ |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Firebase Admin Service Account Email | ✅ |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Firebase Admin Private Key (with `\n`) | ✅ |

### Development

```bash
# Start dev server
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Type check
npx tsc --noEmit

# Production build
npm run build

# Start production server
npm start
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npx vitest run --coverage

# Run specific test file
npx vitest run src/lib/__tests__/constants.test.ts
```

### Test Coverage Areas
- ✅ Constants & Configuration
- ✅ Trust Score Calculations
- ✅ Report Status Transitions
- ✅ SLA Time Calculations
- ✅ Cross-Tenant Isolation Logic
- ✅ Invitation State Machine
- ✅ API Key Format Validation
- ✅ Escalation Levels
- ✅ Moderation & Dispute Statuses

---

## 🔐 Security

### Firestore Rules Highlights
- **Tenant Isolation**: All reads/writes require matching `organizationId`
- **Role Enforcement**: Server-side validation via Admin SDK
- **Immutable Audit Logs**: Write-once, admin-readable only
- **Protected Fields**: Residents cannot modify `moderationStatus`, `disputeStatus`, `resolutionNote`, SLA timestamps
- **API Key Security**: Keys hashed with SHA-256, never stored in plaintext

### Data Protection
- No PII in client-side logs
- Private case notes hidden from residents
- Secure password handling via Firebase Auth
- Rate limiting on all API endpoints

---

## 📦 Deployment

### Vercel (Recommended)

1. **Connect Repository**: Import project in Vercel dashboard
2. **Configure Environment Variables**: Add all variables from `.env.local` (names only, no values in repo)
3. **Deploy**: Vercel auto-detects Next.js and builds

```bash
# Or deploy via CLI
npx vercel --prod
```

### Manual Firebase Setup Required
Before first deployment:
1. Enable **Email/Password** and **Google** providers in Firebase Auth
2. Create **Firestore database** in Native mode
3. Deploy **Firestore rules** (`firestore.rules`) and **indexes** (`firestore.indexes.json`)
4. Create **Service Account** for Admin SDK (Project Settings → Service Accounts)
5. Configure **Cloudinary** upload preset (unsigned, folder: `civicpulse_reports`)

### Firestore Indexes Required
See `FIRESTORE_INDEXES.md` for complete list. Key indexes:
- `reports`: `organizationId + createdAt desc`
- `reports`: `organizationId + status + createdAt desc`
- `reports`: `organizationId + assignedTo + status`
- `auditLogs`: `organizationId + timestamp desc`
- `notifications`: `userId + read + createdAt desc`

---

## 🗺️ Roadmap

### v1.1 (Near Term)
- [ ] Email notifications (SendGrid/Resend integration)
- [ ] CSV/PDF export for analytics
- [ ] Webhook support for external integrations
- [ ] Mobile-responsive PWA enhancements

### v1.2 (Medium Term)
- [ ] Offline-first report creation (Service Workers)
- [ ] Rich text editor for descriptions
- [ ] Custom report categories per organisation
- [ ] Advanced SLA breach escalation rules

### v2.0 (Future)
- [ ] Multi-language support (i18n)
- [ ] AI-assisted categorisation (optional)
- [ ] Public status pages for transparency
- [ ] Native mobile apps (React Native)

---

## ⚠️ Known Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| No real-time chat | Team coordination limited | Use comments + notifications |
| Single photo per report (initial) | Limited evidence | Resolution evidence supports multiple |
| No recurring reports | Manual re-reporting needed | Duplicate detection helps |
| Firebase Spark plan limits | 50K reads/day free tier | Monitor usage, upgrade for production |
| No built-in SMS | Limited notification channels | Email + in-app available |

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/civicpulse/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/civicpulse/discussions)
- **Email**: support@civicpulse.example.com

---

<div align="center">

**Built with ❤️ for stronger communities**

</div>