# Snow Day Predictor Canada - Deployment Guide

## SEO Improvements Added ✅
- Comprehensive meta tags (title, description, keywords)
- Open Graph tags for social media sharing
- Twitter Card metadata
- Schema.org structured data for rich snippets
- Canonical URL
- Custom favicon (snowflake emoji)

## Firebase Deployment Steps

### 1. Install Firebase CLI
```bash
npm install -g firebase-tools
```

### 2. Login to Firebase
```bash
firebase login
```

### 3. Initialize Firebase Project
```bash
cd "c:\Users\Ali Hammoud\SnowDay"
firebase init
```
Select:
- Hosting
- Functions
- Use existing project or create new one

### 4. Deploy Backend (Cloud Functions)
Your Flask app needs to be converted to a Cloud Function. Alternative: Deploy to **Cloud Run** instead:

```bash
# Install Google Cloud CLI first
gcloud init
gcloud run deploy snowday-api --source ./backend --region us-central1 --allow-unauthenticated
```

### 5. Update API URL in script.js
After deploying backend, update the API URL in `public/script.js`:
```javascript
const API_URL = 'https://your-cloud-run-url.run.app';
```

### 6. Deploy Frontend
```bash
firebase deploy --only hosting
```

## Alternative: Quick Start with Netlify (Easier)

### Frontend Only
1. Go to [netlify.com](https://netlify.com)
2. Drag & drop the `public` folder
3. Done! Frontend is live in 30 seconds

### Backend
Deploy to [Railway.app](https://railway.app) or [Render.com](https://render.com):
1. Connect GitHub repo
2. Select `backend` folder
3. Auto-deploys on push

## SEO Best Practices (Next Steps)

1. **Create a sitemap.xml**
2. **Submit to Google Search Console**
3. **Get backlinks** - Share on Reddit, social media
4. **Add blog content** - "How snow days are predicted", "Winter weather tips"
5. **Page speed** - Already optimized with minimal JS
6. **Mobile-friendly** - Already responsive
7. **HTTPS** - Firebase/Netlify provides this automatically

## Domain Name
Buy a domain like `snowdaypredictor.ca` from:
- Namecheap
- Google Domains
- GoDaddy

Connect it to your Firebase/Netlify hosting.

## Expected Timeline
- Deployment: 1-2 hours
- Appearing in Google: 1-2 weeks
- First page ranking: 3-12 months (with SEO work)
