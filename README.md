# Disaster Alert Aggregator PH

A real-time disaster alert aggregator for the Philippines, collecting information from official government sources including PAGASA and PHIVOLCS.

![Disaster Alert Aggregator PH](./public/image.png)

## 📋 Project Overview

This application aggregates and displays real-time disaster alerts in the Philippines by:

1. Scraping official government sources (PAGASA, PHIVOLCS)
2. Categorizing alerts by severity and type
3. Storing alerts in a Supabase database
4. Displaying them through a React + TypeScript frontend with real-time updates

The system is designed to capture all levels of disaster alerts - from high-risk emergency situations to low-level weather advisories - enabling users to stay informed and prepare proactively.

### Key Features

- **Real-time Updates**: Displays alerts as they are published using Supabase Realtime
- **Alert Coverage**: Captures all disaster-related information, including low-level alerts and general weather conditions
- **Risk Severity Indication**: Categorizes alerts by severity (high, medium, low) to help prioritize response
- **Advanced Filtering**: Filter alerts by category, region, and severity level
- **Mobile-First Design**: Responsive interface built with Tailwind CSS
- **Automated Scraping**: Scheduled scraper runs every 15 minutes via GitHub Actions

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend DB**: Supabase (PostgreSQL, Realtime, Auth, Storage)
- **Web Scraper**: Node.js with Cheerio for alert extraction
- **Deployment**: Vercel (Frontend), Supabase (Backend), GitHub Actions (Scraper Scheduler)

## 🚀 Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn
- Supabase account

### Setup

1. **Clone the repository**

```bash
git clone https://github.com/KCprsnlcc/disaster-alert-aggregator-ph.git
cd disaster-alert-aggregator-ph
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up Supabase**

   - Create a new Supabase project
   - Run the SQL in `db/schema.sql` in the Supabase SQL editor
   - Get your Supabase URL and anon key from the API settings

4. **Configure environment variables**

   Create a `.env` file in the root directory with:

```
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

5. **Start the development server**

```bash
npm start
```

## 🤖 Running the Scraper

The scraper fetches data from PAGASA and PHIVOLCS websites and stores it in your Supabase database.

### Local Testing

```bash
cd scraper
npm install
node index.js
```

The scraper will collect alerts from all risk levels, including low-risk conditions, and categorize them by severity.

### Deployment

The scraper is designed to run in GitHub Actions using the workflow in `.github/workflows/scraper-schedule.yml`.

You'll need to add your Supabase credentials as GitHub Secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## 📱 Frontend Structure

- `src/components/Dashboard.tsx`: Main component that fetches and displays alerts
- `src/components/AlertCard.tsx`: Card component for individual alerts with severity indicators
- `src/components/FilterBar.tsx`: Filtering UI for category, region, and severity level
- `src/supabase.ts`: Supabase client and TypeScript types

## 🧪 Testing

```bash
npm test
```

## 📦 Building for Production

```bash
npm run build
```

The build output will be in the `build` directory.

## 📤 Deployment

### Frontend (Vercel)

1. Connect your GitHub repository to Vercel
2. Set the environment variables in the Vercel project settings
3. Deploy from the main branch

### Scraper (GitHub Actions)

The scraper will run automatically every 15 minutes once you've set up the GitHub Secrets.

## 📎 Notes

- All timestamps are in Philippine Standard Time (UTC+8)
- No login is required to view alerts (anonymous public access)
- Alerts are categorized by severity (high, medium, low) to help users prioritize their response
- The system captures all types of alerts, including low-level advisories that may develop into more serious situations
- Categories include: typhoon, earthquake, flood, volcano, rainfall, landslide, and general weather
- Data is sourced from official government websites, but this is not an official service

## 🙏 Acknowledgements

- [PAGASA](https://www.pagasa.dost.gov.ph/) - Philippine Atmospheric, Geophysical and Astronomical Services Administration
- [PHIVOLCS](https://www.phivolcs.dost.gov.ph/) - Philippine Institute of Volcanology and Seismology
