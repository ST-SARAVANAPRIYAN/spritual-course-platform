# Default Admin Fix - Complete Solution

## Problem Identified
The default admin was unable to disable or delete other admins due to:
1. **Auth middleware not including `isDefaultAdmin`** in `req.user`
2. **No default admin set in database** - Need to designate one admin as default

## Fixes Applied

### 1. Backend Fixes

#### A. Auth Middleware ([auth.js](backend/middleware/auth.js))
**Fixed**: Include `isDefaultAdmin` field in request user object
```javascript
// Now includes isDefaultAdmin when fetching user
const user = await User.findById(decoded.id).select('active role name isDefaultAdmin');

// Sets it in req.user for use in controllers
req.user = {
    ...decoded,
    isDefaultAdmin: user.isDefaultAdmin || false
};
```

#### B. Admin Controller ([adminController.js](backend/controllers/adminController.js))
**Optimized**: Use `req.user.isDefaultAdmin` directly instead of additional database queries

- **deleteUser()** - Now checks `req.user.isDefaultAdmin` directly
- **toggleUserStatus()** - Now checks `req.user.isDefaultAdmin` directly
- **setDefaultAdmin()** - Now checks `req.user.isDefaultAdmin` directly

### 2. Frontend Debugging Added

Added console logging in [admin.js](frontend/js/admin.js) to help diagnose issues:
- Shows current user's `isDefaultAdmin` status
- Shows each admin user being rendered
- Displays button logic decisions

## How to Fix Your Issue

### Step 1: Set Default Admin in Database

You need to designate one admin as the default admin. Run this command:

```bash
node backend/scripts/set_default_admin.js <admin_email_or_studentID>
```

**Example:**
```bash
# Using email
node backend/scripts/set_default_admin.js admin@innerspark.com

# OR using Student ID
node backend/scripts/set_default_admin.js ADM-2026-0001
```

The script will:
- ✅ Find the admin user
- ✅ Remove default status from other admins
- ✅ Set the specified admin as default
- ✅ Show confirmation message

### Step 2: Restart Server

After setting the default admin, restart your Node.js server:

```bash
# Stop the server (Ctrl+C)
# Then restart
node server.js
```

### Step 3: Log Out and Log Back In

**CRITICAL**: The logged-in user's session doesn't automatically update. You must:
1. Log out from admin dashboard
2. Log back in with the default admin credentials
3. The login response will now include `isDefaultAdmin: true`

### Step 4: Verify It Works

After logging back in, open browser console (F12) and check:

```
🔍 DEBUG - Current User: {id: "...", name: "...", isDefaultAdmin: true}
🔍 DEBUG - isCurrentUserDefaultAdmin: true
```

When viewing the user management table:
- **As Default Admin**: Should see active Disable/Delete buttons for other admins
- **As Normal Admin**: Should see locked buttons with tooltips

## Testing Checklist

### As Default Admin ✅
- [ ] Can see active "Disable" button for other admins
- [ ] Can see active "Delete" button for other admins  
- [ ] Can see "Set as Default" button for other admins
- [ ] Can successfully disable another admin
- [ ] Can successfully delete another admin
- [ ] Can transfer default admin role to another admin
- [ ] Cannot disable themselves
- [ ] Cannot delete themselves
- [ ] Can manage all students and staff normally

### As Normal Admin ✅
- [ ] Sees locked 🔒 button instead of "Disable" for other admins
- [ ] Sees locked 🔒 button instead of "Delete" for other admins
- [ ] Sees locked 🔒 button instead of "Set as Default"
- [ ] Tooltips explain "Only default admin can..."
- [ ] Can still manage all students and staff
- [ ] Can still edit admin profiles (non-privilege fields)

## Files Modified

1. **backend/middleware/auth.js**
   - Added `isDefaultAdmin` to user selection
   - Included `isDefaultAdmin` in `req.user` object

2. **backend/controllers/adminController.js**
   - Optimized `deleteUser()` - use `req.user.isDefaultAdmin`
   - Optimized `toggleUserStatus()` - use `req.user.isDefaultAdmin`
   - Optimized `setDefaultAdmin()` - use `req.user.isDefaultAdmin`

3. **frontend/js/admin.js**
   - Added debugging console logs
   - Button rendering logic already correct

4. **backend/scripts/set_default_admin.js** (NEW)
   - Utility script to set first default admin

## Database Requirements

Ensure your User model has:
```javascript
isDefaultAdmin: { type: Boolean, default: false }
```

✅ Already present in your schema at [backend/models/index.js](backend/models/index.js) line 20

## Troubleshooting

### Issue: Still showing locked buttons for default admin

**Solution**: 
1. Check browser console for debug output
2. Verify `isCurrentUserDefaultAdmin: true`
3. If false, log out and log back in
4. Clear browser cache if needed

### Issue: "No admin users found"

**Solution**:
1. Create an admin user first via register page OR admin dashboard
2. Then run the set_default_admin script

### Issue: Script shows error connecting to MongoDB

**Solution**:
1. Ensure MongoDB is running
2. Check `MONGO_URI` in your `.env` file
3. Verify database connection string is correct

## Remove Debugging (After Testing)

Once everything works, remove the console.log statements:

1. In [admin.js](frontend/js/admin.js) around line 267-273
2. In [admin.js](frontend/js/admin.js) around line 313-319

## Security Notes

- ✅ Only ONE admin can be default at a time
- ✅ Default admin has highest privileges
- ✅ Backend validates all operations
- ✅ Frontend buttons match backend logic
- ✅ All privilege checks happen server-side
- ✅ JWT includes user identity
- ✅ Database queries verify permissions

## Additional Features

### Transfer Default Admin Role
Default admin can transfer their role to another admin using the "Set as Default" button (shield icon).

When transferred:
- Previous default admin becomes normal admin
- New admin becomes default admin
- All privileges transfer instantly
- **Must log out and log back in** for changes to take effect

## Support

If issues persist after following all steps:
1. Check server console for errors
2. Check browser console for debug output
3. Verify database connection
4. Ensure server was restarted
5. Confirm you logged out and back in
