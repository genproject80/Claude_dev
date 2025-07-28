-- Update demo viewer user to new dashboard_viewer role
-- This gives the user access to both IoT and Motor dashboards without admin privileges

UPDATE users 
SET roles = 'dashboard_viewer'
WHERE email = 'viewer@demo.com';

-- Verify the update
SELECT id, user_name, email, roles, client_id 
FROM users 
WHERE email = 'viewer@demo.com';