-- Create User_Sessions table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='User_Sessions' AND xtype='U')
BEGIN
    CREATE TABLE User_Sessions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        session_token NVARCHAR(500) NOT NULL,
        login_time DATETIME2 NOT NULL DEFAULT GETDATE(),
        logout_time DATETIME2 NULL,
        ip_address NVARCHAR(45) NULL,
        user_agent NVARCHAR(500) NULL,
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        -- Foreign key constraint (if users table exists)
        CONSTRAINT FK_User_Sessions_Users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        
        -- Index for better performance
        INDEX IX_User_Sessions_UserId (user_id),
        INDEX IX_User_Sessions_SessionToken (session_token),
        INDEX IX_User_Sessions_IsActive (is_active),
        INDEX IX_User_Sessions_LoginTime (login_time)
    );
    
    PRINT 'User_Sessions table created successfully';
END
ELSE
BEGIN
    PRINT 'User_Sessions table already exists';
END

-- Verify the table structure
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'User_Sessions'
ORDER BY ORDINAL_POSITION;