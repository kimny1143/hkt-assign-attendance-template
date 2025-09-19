-- staff1@haas.test のuser_idを更新
UPDATE staff 
SET user_id = 'fa9a6d05-2986-46d0-9f0e-6df74018d6ff'
WHERE email = 'staff1@haas.test';

-- 他のユーザーも作成されていれば、以下のように更新してください
-- UPDATE staff SET user_id = 'YOUR_AUTH_USER_ID' WHERE email = 'admin@haas.test';
-- UPDATE staff SET user_id = 'YOUR_AUTH_USER_ID' WHERE email = 'manager@haas.test';
-- UPDATE staff SET user_id = 'YOUR_AUTH_USER_ID' WHERE email = 'staff2@haas.test';
-- UPDATE staff SET user_id = 'YOUR_AUTH_USER_ID' WHERE email = 'staff3@haas.test';
-- UPDATE staff SET user_id = 'YOUR_AUTH_USER_ID' WHERE email = 'staff4@haas.test';
-- UPDATE staff SET user_id = 'YOUR_AUTH_USER_ID' WHERE email = 'staff5@haas.test';

-- 更新結果を確認
SELECT id, name, email, user_id, role FROM staff;