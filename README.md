# SwapRunn Logistics Platform

A modern web application connecting car dealerships, sales staff, and drivers for seamless vehicle deliveries and dealer swaps.

## Overview

SwapRunn simplifies the logistics of vehicle transportation by providing a dedicated platform for three key user types:

- **Dealerships**: Manage deliveries, track drivers, and oversee sales teams
- **Sales Staff**: Request deliveries and track vehicle transportation
- **Drivers**: Accept assignments, update delivery status, and communicate with dealerships

## Features

### Core Functionality
- **Role-based Authentication**: Separate login flows for dealers, sales staff, and drivers
- **Real-time Chat**: In-app messaging for each delivery
- **Delivery Management**: Create, assign, track, and complete deliveries
- **Search & Filter**: Quickly find deliveries by VIN, location, or status
- **Status Tracking**: Monitor deliveries through pending, assigned, in-progress, and completed states

### User Experience
- **Loading Skeletons**: Smooth loading states for better UX
- **Toast Notifications**: Real-time feedback for user actions
- **Empty States**: Helpful guidance when no data is available
- **Mobile Responsive**: Optimized for all screen sizes
- **Password Recovery**: Forgot password and reset password flows

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Build Tool**: Vite
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd swaprunn
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:
```
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

4. Run database migrations:

The migration file is located at `supabase/migrations/20251111051258_create_swaprunn_schema.sql`

Apply it through the Supabase dashboard or CLI.

5. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Database Schema

### Tables

- **dealers**: Dealership information and credentials
- **sales**: Sales staff linked to dealerships
- **drivers**: Driver profiles with vehicle and service area details
- **deliveries**: Delivery requests with status tracking
- **messages**: Chat messages for each delivery

### Row Level Security (RLS)

All tables have RLS enabled with policies ensuring:
- Users only access data relevant to their role
- Dealers can view their deliveries and team
- Drivers can view assigned and available deliveries
- Sales staff can view their own requests
- Messages are only visible to sender and recipient

## Project Structure

```
swaprunn/
├── src/
│   ├── components/
│   │   ├── ui/           # Reusable UI components
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   └── ToastContext.tsx
│   ├── lib/
│   │   ├── supabase.ts   # Supabase client & types
│   │   ├── auth.ts       # Authentication helpers
│   │   ├── validation.ts # Form validation
│   │   └── constants.ts  # App constants
│   ├── pages/            # All page components
│   ├── App.tsx
│   └── main.tsx
├── supabase/
│   └── migrations/       # Database migrations
├── public/
└── package.json
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy

### Build Output

```bash
npm run build
```

Output will be in the `dist/` directory.

## User Flows

### Dealership Flow
1. Register as dealer
2. View dashboard with active deliveries
3. Create new delivery (assign driver or leave unassigned)
4. Track delivery status
5. Chat with drivers and sales staff

### Sales Staff Flow
1. Register with dealer invitation code
2. View personal deliveries
3. Request new delivery
4. Chat with assigned driver

### Driver Flow
1. Register as driver (vehicle type, service radius)
2. Toggle availability status
3. View available deliveries
4. Accept delivery
5. Update status (start, complete)
6. Chat with dealership/sales

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous key |

## Security

- All routes are protected with authentication checks
- Database access is controlled via Row Level Security
- Passwords are hashed via Supabase Auth
- API keys are never exposed in client code

## Contributing

This is a private project. For questions or issues, contact the development team.

## License

Proprietary - All rights reserved
