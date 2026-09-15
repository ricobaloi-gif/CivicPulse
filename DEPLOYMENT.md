# Deployment Guide

This document provides step-by-step instructions for deploying CivicPulse to production.

## Prerequisites

- [ ] GitHub repository with code
- [ ] Vercel account
- [ ] Firebase project (Blaze plan recommended for production)
- [ ] Cloudinary account
- [ ] Domain name (optional, Vercel provides `*.vercel.app`)

---

## 1. Firebase Project Setup

### 1.1 Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Add Project** → Enter name → Continue
3. Enable **Google Analytics** (optional)
4. Wait for provisioning

### 1.2 Enable Authentication
1. In Firebase Console → **Authentication** → **Sign-in method**
2. Enable **Email/Password**
3. Enable **Google** (configure OAuth consent screen first)
4. Add authorised domains:
   - `localhost` (development)
   - `your-domain.vercel.app` (production)
   - `your-custom-domain.com` (if using custom domain)

### 1.3 Create Firestore Database
1. Go to **Firestore Database** → **Create database**
2. Start in **Production mode**
3. Choose location (closest to users)
3. Wait for creation

### 1.4 Deploy Firestore Rules & Indexes

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialise (select Firestore, Functions, Hosting)
firebase init

# Deploy rules
firebase deploy --only firestore:rules,firestore:indexes
```

**Required Rules File** (`firestore.rules`):
- Already in repository root
- Enforces tenant isolation, role-based access, immutable audit logs

**Required Indexes** (`firestore.indexes.json` or `FIRESTORE_INDEXES.md`):
- See `FIRESTORE_INDEXES.md` for complete list

### 1.5 Create Service Account (Admin SDK)
1. Project Settings (⚙️) → **Service Accounts**
2. Click **Generate New Private Key**
3. Save JSON securely — **never commit to git**
4. Extract values for environment variables:
   - `FIREBASE_ADMIN_PROJECT_ID` → `project_id`
   - `FIREBASE_ADMIN_CLIENT_EMAIL` → `client_email`
   - `FIREBASE_ADMIN_PRIVATE_KEY` → `private_key` (keep `\n` literals)

---

## 2. Cloudinary Setup

### 2.1 Create Account
1. Sign up at [Cloudinary](https://cloudinary.com)
2. Note your **Cloud Name** from Dashboard

### 2.2 Create Upload Preset
1. Settings (⚙️) → **Upload** → **Upload presets**
2. Click **Add upload preset**
3. Configure:
   - **Name**: `civicpulse_reports` (or your choice)
   - **Signing Mode**: **Unsigned**
   - **Folder**: `civicpulse_reports`
   - **Allowed formats**: `jpg, jpeg, png, webp`
   - **Max file size**: 10MB
   - **Transformation**: `w_1920,c_limit,q_auto:good`
4. Save

### 2.3 Environment Variables
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` → Your Cloud Name
- `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` → Your Upload Preset Name

---

## 3. Vercel Deployment

### 3.1 Connect Repository
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New...** → **Project**
3. Import from GitHub → Select `civicpulse`
4. Vercel auto-detects Next.js

### 3.2 Configure Environment Variables
In Vercel Project Settings → **Environment Variables**, add:

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | From Firebase Console → Project Settings → Web App | Production, Preview, Development |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` | All |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Your Firebase Project ID | All |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com` | All |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | From Firebase Console | All |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | From Firebase Console → Web App config | All |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Your Cloudinary Cloud Name | All |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Your Upload Preset Name | All |
| `FIREBASE_ADMIN_PROJECT_ID` | From Service Account JSON | All |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | From Service Account JSON | All |
| `FIREBASE_ADMIN_PRIVATE_KEY` | From Service Account JSON (with `\n`) | All |

**Important**: For `FIREBASE_ADMIN_PRIVATE_KEY`, copy the entire value including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`, keeping `\n` as literal backslash-n characters.

### 3.3 Deploy
1. Click **Deploy** in Vercel
2. Wait for build to complete
3. Verify deployment at `https://your-project.vercel.app`

### 3.4 Custom Domain (Optional)
1. In Vercel Project Settings → **Domains**
2. Add your domain → Follow DNS verification steps
3. Update Firebase Auth authorised domains to include custom domain

---

## 4. Post-Deployment Verification

### 4.1 Smoke Tests
- [ ] Landing page loads
- [ ] User registration works
- [ ] User login works
- [ ] Organisation setup works
- [ ] Report creation with photo works
- [ ] Map loads with correct location
- [ ] Report browsing works
- [ ] Admin dashboard accessible (admin user)
- [ ] Analytics page loads with data
- [ ] Audit log accessible (admin user)
- [ ] API endpoints respond (with valid API key)

### 4.2 Create First Admin User
1. Register normally at `/register`
2. In Firebase Console → **Firestore** → `users` collection
3. Find your user document → Edit:
   - `role`: `"admin"`
   - `organizationRole`: `"owner"`
   - `organizationId`: (your org ID after setup)
4. Or use the `/organization/setup` page to create org first

### 4.3 Verify Firestore Rules
```bash
# Test rules locally (optional)
firebase emulators:start --only firestore
```

---

## 5. CI/CD Pipeline

### GitHub Actions
The repository includes `.github/workflows/ci.yml` which runs on every push/PR:

```yaml
jobs:
  lint:     # ESLint
  test:     # Vitest
  build:    # Next.js build
  typecheck: # TypeScript compilation
```

### Required GitHub Secrets
Add in GitHub Repository Settings → **Secrets and variables** → **Actions**:

| Secret | Description |
|--------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API Key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase App ID |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary Cloud Name |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Cloudinary Upload Preset |
| `FIREBASE_ADMIN_PROJECT_ID` | Firebase Admin Project ID |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Firebase Admin Client Email |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Firebase Admin Private Key |

---

## 6. Monitoring & Maintenance

### 6.1 Health Checks
- **Vercel Analytics**: Enable in Vercel Dashboard
- **Firebase Console**: Monitor Auth, Firestore, Functions usage
- **Cloudinary Dashboard**: Monitor storage/bandwidth

### 6.2 Logs
- **Vercel Function Logs**: Dashboard → Functions → View logs
- **Firebase Functions Logs**: `firebase functions:log`
- **Browser Console**: For client-side errors

### 6.3 Backups
- **Firestore**: Enable automatic backups (Blaze plan)
- **Export**: Use `gcloud firestore export gs://your-bucket/backup`

### 6.4 Updates
```bash
# Update dependencies
npm update

# Check for breaking changes
npm outdated

# Test locally before deploying
npm run build && npm test
```

---

## 7. Rollback Procedure

### Vercel Rollback
1. Go to Vercel Dashboard → **Deployments**
2. Find previous successful deployment
3. Click **...** → **Promote to Production**

### Firebase Rollback
```bash
# Rollback Firestore rules
firebase deploy --only firestore:rules -m "Rollback to previous rules"

# Rollback indexes
firebase deploy --only firestore:indexes
```

---

## 8. Troubleshooting

### Build Failures
| Error | Solution |
|-------|----------|
| `FIREBASE_ADMIN_PRIVATE_KEY` invalid | Ensure `\n` are literal, not actual newlines |
| `Module not found: @/src/...` | Check `tsconfig.json` paths alias |
| `TypeScript errors` | Run `npx tsc --noEmit` locally first |

### Runtime Errors
| Error | Solution |
|-------|----------|
| `Permission denied` Firestore | Check rules, user org membership |
| `Image upload failed` | Verify Cloudinary preset is unsigned |
| `Map not loading` | Check MapLibre GL CSS import |
| `API 401 Unauthorized` | Verify API key format (`cp_live_...`) |

### Performance
- Enable **Vercel Edge Functions** for API routes if needed
- Use **Firestore Composite Indexes** for complex queries
- Monitor **Cloudinary transformations** for bandwidth

---

## 9. Security Checklist (Pre-Launch)

- [ ] All environment variables set in Vercel (not in repo)
- [ ] Firebase Auth authorised domains configured
- [ ] Firestore rules deployed and tested
- [ ] API keys generated per organisation (not shared)
- [ ] Cloudinary upload preset is unsigned but folder-restricted
- [ ] No hardcoded secrets in codebase
- [ ] HTTPS enforced (Vercel default)
- [ ] CSP headers configured (Next.js default)
- [ ] Rate limiting active on all API routes
- [ ] Audit logging verified for admin actions

---

## 10. Support Contacts

| Service | Support |
|---------|---------|
| Vercel | [vercel.com/support](https://vercel.com/support) |
| Firebase | [firebase.google.com/support](https://firebase.google.com/support) |
| Cloudinary | [cloudinary.com/support](https://cloudinary.com/support) |
| GitHub Actions | [docs.github.com/actions](https://docs.github.com/en/actions) |

---

*Last Updated: September 2025*
*Version: 1.0.0*