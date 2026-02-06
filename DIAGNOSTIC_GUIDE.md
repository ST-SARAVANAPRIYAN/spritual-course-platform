# DIAGNOSTIC GUIDE - Default Admin Issue

## 🔍 Step-by-Step Debug Process

### Step 1: Check Database Status

Run this command to see which admin is set as default:

```bash
node backend/scripts/check_default_admin.js
```

**Expected Output:**
```
✓ Connected to MongoDB

📋 All Admin Users in Database:
================================

1. Your Name
   Email: your@email.com
   ID: ADM-2026-0001
   Status: ✅ Active
   Default Admin: ⭐ YES (DEFAULT)
   isDefaultAdmin field: true

================================
Total Admins: 1
Default Admins: 1

✅ Default admin configuration is correct!
Default Admin: Your Name (your@email.com)
```

**If you see:**
- `Default Admin: ❌ No` → You need to set default admin (Step 2)
- `Default Admins: 0` → No default admin set (Step 2)
- Multiple admins with `⭐ YES (DEFAULT)` → Database corruption (Step 6)

---

### Step 2: Set Default Admin (If Needed)

If Step 1 showed no default admin, run:

```bash
node backend/scripts/set_default_admin.js <your_email>
```

Example:
```bash
node backend/scripts/set_default_admin.js admin@innerspark.com
```

**Expected Output:**
```
✅ Success! Default admin has been set:
   Name: Your Name
   Email: admin@innerspark.com
   ID: ADM-2026-0001

⚠️  IMPORTANT: You must log out and log back in for changes to take effect!
```

---

### Step 3: Restart Server

Stop and restart your Node.js server:

```bash
# Press Ctrl+C to stop
# Then restart:
node server.js
```

---

### Step 4: Clear Browser & Log Out

**CRITICAL STEP:**

1. Open your browser's DevTools (F12)
2. Go to Console tab
3. Run this command:
```javascript
localStorage.clear();
window.location.href = 'login.html';
```

OR manually:
1. Log out from admin dashboard
2. Clear browser cache (Ctrl+Shift+Delete)
3. Close and reopen browser

---

### Step 5: Log Back In

1. Navigate to login page
2. Enter your admin credentials
3. Log in

---

### Step 6: Check Diagnostic Panel

After logging in, you should see a **purple diagnostic panel** at the top of the admin dashboard.

**✅ SUCCESS - Should show:**
```
⭐ DEFAULT ADMIN
You have full privileges to manage all admins, staff, and students.
```

**❌ PROBLEM - If it shows:**
```
⚠️ STALE SESSION DATA
Your session is missing privilege data. Please log out and log back in.
```
→ Go back to Step 4

**❌ PROBLEM - If it shows:**
```
👤 NORMAL ADMIN
You can manage students and staff, but not other admins (requires default admin).
```
→ Database has wrong user as default, go back to Step 1

---

### Step 7: Check Browser Console

Open DevTools (F12) → Console tab

You should see:
```
🔍 DEBUG - Current User Object: {id: "...", name: "...", role: "Admin", isDefaultAdmin: true}
🔍 DEBUG - isDefaultAdmin value: true
🔍 DEBUG - Type of isDefaultAdmin: boolean
🔍 DEBUG - isCurrentUserDefaultAdmin result: true
```

**❌ If you see `isDefaultAdmin: false`:**
- Database has wrong user set as default
- Run Step 1 to verify
- Ensure you logged in with the correct account

**❌ If you see `isDefaultAdmin: undefined`:**
- You didn't log out and back in after setting default admin
- Go back to Step 4

---

### Step 8: Test Admin Management

Go to **User Management** → **Admins** tab

**As Default Admin, you should see:**
- ✅ Active "Disable" button for other admins
- ✅ Active "Delete" button (trash icon) for other admins
- ✅ Active "Set as Default" button (shield icon) for other admins

**If you still see locked 🔒 buttons:**
1. Check browser console for errors
2. Click "Refresh Status" button in diagnostic panel
3. If still not working, check backend logs for errors

---

## 🐛 Common Issues & Solutions

### Issue: "isDefaultAdmin field: undefined" in database check

**Solution:**
```bash
# Connect to MongoDB and update the field manually
mongosh innerspark
db.users.updateOne(
  { email: "your@email.com", role: "Admin" },
  { $set: { isDefaultAdmin: true } }
)
db.users.updateMany(
  { role: "Admin", email: { $ne: "your@email.com" } },
  { $set: { isDefaultAdmin: false } }
)
```

### Issue: Browser console shows old user object

**Solution:**
```javascript
// In browser console (F12)
console.log('Current localStorage:', localStorage.getItem('user'));
localStorage.removeItem('user');
localStorage.removeItem('token');
location.reload();
```

### Issue: Multiple default admins in database

**Solution:**
```bash
# Run the set_default_admin script again
node backend/scripts/set_default_admin.js <correct_email>
```

### Issue: Server not returning isDefaultAdmin

**Check backend logs for errors:**
1. Look for authentication middleware errors
2. Check if User model has isDefaultAdmin field
3. Verify auth middleware is selecting the field

**Manually test the endpoint:**
```bash
# Get your token from localStorage
# Then test:
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5001/api/auth/profile
```

Should return:
```json
{
  "status": "success",
  "data": {
    "isDefaultAdmin": true,
    ...
  }
}
```

### Issue: Diagnostic panel not showing

**Check:**
1. Is `adminStatusDiagnostic` element in HTML?
2. Is `checkAdminStatusDiagnostic()` being called?
3. Browser console shows any JavaScript errors?

---

## 📝 Quick Checklist

Use this checklist to verify everything:

- [ ] Database has exactly ONE admin with `isDefaultAdmin: true`
- [ ] Server is restarted after database changes
- [ ] Logged out completely and cleared localStorage
- [ ] Logged back in with correct admin credentials
- [ ] Diagnostic panel shows "⭐ DEFAULT ADMIN"
- [ ] Browser console shows `isDefaultAdmin: true`
- [ ] Can see active (not locked) buttons for admin management
- [ ] Successfully tested disabling another admin
- [ ] Successfully tested deleting another admin

---

## 🆘 Still Not Working?

If you've followed all steps and it's still not working:

1. **Capture diagnostics:**
   - Screenshot of database check output
   - Screenshot of browser console output
   - Screenshot of diagnostic panel
   - Backend server logs

2. **Verify files are saved:**
   ```bash
   # Check if changes are in place
   grep -n "isDefaultAdmin" backend/middleware/auth.js
   grep -n "checkAdminStatusDiagnostic" frontend/js/admin.js
   ```

3. **Check if you're editing the right files:**
   - Ensure you're running the server from the correct directory
   - Verify frontend files are being served from the correct path
   - Check if there's a build process caching old files

4. **Nuclear option - Full reset:**
   ```bash
   # Stop server
   # Clear all sessions
   redis-cli FLUSHALL  # If using Redis
   # Restart everything
   node backend/scripts/set_default_admin.js your@email.com
   node server.js
   # Clear browser completely
   # Log in fresh
   ```
