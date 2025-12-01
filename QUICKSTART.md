# SwapRunn - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Prerequisites
- Node.js 18+ installed
- Supabase account (free tier works)
- Git

### 2. Clone & Install
```bash
git clone <your-repo-url>
cd swaprunn
npm install
```

### 3. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run Database Migrations

In Supabase Dashboard:
1. Go to SQL Editor
2. Copy contents of `supabase/migrations/20251111051258_create_swaprunn_schema.sql`
3. Run the migration
4. Copy contents of `supabase/migrations/20251111120000_add_notifications.sql`
5. Run the migration

### 5. Start Development Server
```bash
npm run dev
```

Visit `http://localhost:5173`

### 6. Test the App

**Register 3 Test Users:**

1. **Dealer**
   - Go to "Register Dealership"
   - Name: Test Dealer
   - Email: dealer@test.com
   - Password: test1234

2. **Driver**
   - Go to "Register Driver"
   - Name: Test Driver
   - Email: driver@test.com
   - Vehicle: Truck
   - Radius: 50 miles
   - Password: test1234

3. **Salesperson**
   - First, login as dealer
   - Create an invitation (if implemented)
   - Or directly register with dealer_id from database
   - Name: Test Sales
   - Email: sales@test.com
   - Password: test1234

**Create a Test Delivery:**

1. Login as dealer (dealer@test.com / test1234)
2. Click "New Delivery" tab
3. Fill in:
   - Pickup: 123 Main St, City A
   - Dropoff: 456 Oak Ave, City B
   - VIN: 1HGBH41JXMN109186
   - Assign to Test Driver
4. Click "Create Delivery"

**Accept & Complete:**

1. Login as driver (driver@test.com / test1234)
2. See the assigned delivery
3. Click "Start Delivery"
4. Open chat and send a message
5. Click "Complete Delivery"

**Check Notifications:**

1. Click bell icon in header
2. See notification about delivery status
3. Click notification to view details

---

## 🎯 Key Features to Test

### For Dealers
- ✅ Create deliveries
- ✅ Search by VIN
- ✅ Filter by status
- ✅ View available drivers
- ✅ View sales team
- ✅ Chat with drivers

### For Drivers
- ✅ Toggle availability
- ✅ View available deliveries
- ✅ Accept deliveries
- ✅ Update status
- ✅ Chat with dealers

### For Sales
- ✅ Request deliveries
- ✅ View request status
- ✅ Chat with drivers

---

## 📦 Deploy to Vercel

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy!

Your app will be live at `https://your-app.vercel.app`

---

## 🐛 Troubleshooting

### Build Fails
```bash
npm run typecheck
npm run lint
```
Fix any errors shown

### Database Connection Issues
- Verify `.env` has correct Supabase URL
- Check Supabase project is not paused
- Ensure anon key is correct

### Migrations Not Working
- Run migrations in order
- Check Supabase Dashboard > Database > Migrations
- Verify RLS policies are enabled

### Notifications Not Appearing
- Check notifications table exists
- Verify RLS policies on notifications
- Ensure user is logged in

---

## 💡 Tips

1. **Use Chrome DevTools** - Check Network tab for API errors
2. **Check Supabase Logs** - Dashboard > Logs for database errors
3. **Test Mobile** - Use Chrome DevTools device emulation
4. **Clear Cache** - Hard refresh with Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

---

## 📞 Need Help?

- Check `README.md` for detailed documentation
- Review `IMPROVEMENTS.md` for feature explanations
- Check Supabase docs: [supabase.com/docs](https://supabase.com/docs)
- Check Vite docs: [vitejs.dev](https://vitejs.dev)

---

**Happy coding! 🎉**
