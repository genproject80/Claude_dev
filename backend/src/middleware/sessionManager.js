import database from '../config/database.js';
import { randomUUID } from 'crypto';

class SessionManager {
  // Create a new session when user logs in
  static async createSession(userId, token, req) {
    try {
      const userAgent = req.headers['user-agent'] || 'Unknown';
      const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'Unknown';
      
      console.log(`Creating session for user ${userId}, IP: ${ipAddress}`);
      
      // Clean up old expired sessions first
      await this.cleanupExpiredSessions();
      
      // Calculate expiration time (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      // Create new session record using existing table structure
      const sessionId = randomUUID();
      const result = await database.query(`
        INSERT INTO User_Sessions (
          session_id,
          user_id, 
          session_token, 
          expires_at,
          created_at,
          last_activity
        )
        OUTPUT INSERTED.session_id
        VALUES (@sessionId, @userId, @token, @expiresAt, GETDATE(), GETDATE())
      `, {
        sessionId,
        userId: userId.toString(),
        token,
        expiresAt
      });

      console.log(`Session created successfully with ID: ${result[0]?.session_id}`);
      return result[0]?.session_id;
    } catch (error) {
      console.error('Error creating session:', error);
      console.error('Error details:', error.message);
      return null;
    }
  }

  // Update session on logout
  static async endSession(token) {
    try {
      await database.query(`
        UPDATE User_Sessions 
        SET expires_at = GETDATE()
        WHERE session_token = @token AND expires_at > GETDATE()
      `, { token });
    } catch (error) {
      console.error('Error ending session:', error);
    }
  }

  // Validate if session is still active
  static async validateSession(token) {
    try {
      const sessions = await database.query(`
        SELECT 
          s.session_id,
          s.user_id,
          s.created_at,
          s.expires_at,
          u.user_name,
          u.email,
          u.roles
        FROM User_Sessions s
        INNER JOIN users u ON CAST(s.user_id AS INT) = u.id
        WHERE s.session_token = @token 
        AND s.expires_at > GETDATE()
      `, { token });

      return sessions[0] || null;
    } catch (error) {
      console.error('Error validating session:', error);
      return null;
    }
  }

  // Get all active sessions for admin
  static async getActiveSessions() {
    try {
      const sessions = await database.query(`
        SELECT 
          s.session_id,
          s.user_id,
          s.session_token,
          s.created_at,
          s.expires_at,
          s.last_activity,
          u.user_name,
          u.email,
          u.roles,
          u.client_id,
          CASE WHEN s.expires_at > GETDATE() THEN 1 ELSE 0 END as is_active
        FROM User_Sessions s
        INNER JOIN users u ON CAST(s.user_id AS INT) = u.id
        WHERE s.created_at > DATEADD(day, -30, GETDATE())
        ORDER BY s.created_at DESC
      `);

      return sessions;
    } catch (error) {
      console.error('Error getting active sessions:', error);
      return [];
    }
  }

  // Get sessions with pagination and filtering
  static async getSessionsPaginated(page = 1, limit = 20, filter = 'active', searchTerm = '', startDate = null, endDate = null, sortBy = 'created_at', sortOrder = 'desc') {
    try {
      const offset = (page - 1) * limit;
      
      // Build WHERE clause based on filter
      let whereClause = '';
      
      // Handle custom date range first
      if (filter === 'custom' && startDate && endDate) {
        whereClause = 'WHERE s.created_at >= @startDate AND s.created_at <= @endDate';
      } else {
        switch (filter) {
          case 'active':
            whereClause = 'WHERE s.expires_at > GETDATE()';
            break;
          case 'recent':
            whereClause = 'WHERE s.created_at > DATEADD(hour, -24, GETDATE())';
            break;
          case 'all':
            whereClause = 'WHERE s.created_at > DATEADD(day, -30, GETDATE())';
            break;
          default:
            whereClause = 'WHERE s.expires_at > GETDATE()';
        }
      }

      // Add search functionality
      const params = {};
      
      // Add date range parameters if custom filter
      if (filter === 'custom' && startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }
      
      if (searchTerm && searchTerm.trim()) {
        const searchWildcard = `%${searchTerm.trim()}%`;
        whereClause += ` AND (
          UPPER(u.user_name) LIKE UPPER(@searchTerm) 
          OR UPPER(u.email) LIKE UPPER(@searchTerm)
          OR CAST(u.id AS NVARCHAR) = @exactSearch
        )`;
        params.searchTerm = searchWildcard;
        params.exactSearch = searchTerm.trim();
      }

      // Get total count for pagination
      const countResult = await database.query(`
        SELECT COUNT(*) as total
        FROM User_Sessions s
        INNER JOIN users u ON CAST(s.user_id AS INT) = u.id
        ${whereClause}
      `, params);

      const total = countResult[0]?.total || 0;

      // Build ORDER BY clause with sorting
      const sortableColumns = {
        'created_at': 's.created_at',
        'user_name': 'u.user_name',
        'email': 'u.email',
        'roles': 'u.roles',
        'expires_at': 's.expires_at',
        'last_activity': 's.last_activity'
      };
      
      const sortColumn = sortableColumns[sortBy] || 's.created_at';
      const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      // Get paginated sessions
      const sessions = await database.query(`
        SELECT 
          s.session_id,
          s.user_id,
          s.session_token,
          s.created_at,
          s.expires_at,
          s.last_activity,
          u.user_name,
          u.email,
          u.roles,
          u.client_id,
          CASE WHEN s.expires_at > GETDATE() THEN 1 ELSE 0 END as is_active
        FROM User_Sessions s
        INNER JOIN users u ON CAST(s.user_id AS INT) = u.id
        ${whereClause}
        ORDER BY ${sortColumn} ${order}
        OFFSET ${offset} ROWS
        FETCH NEXT ${limit} ROWS ONLY
      `, params);

      return {
        sessions,
        total,
        page,
        limit,
        filter,
        searchTerm,
        startDate,
        endDate,
        sortBy,
        sortOrder
      };
    } catch (error) {
      console.error('Error getting paginated sessions:', error);
      return {
        sessions: [],
        total: 0,
        page,
        limit,
        filter,
        searchTerm,
        startDate,
        endDate,
        sortBy,
        sortOrder
      };
    }
  }

  // Get sessions for specific user
  static async getUserSessions(userId) {
    try {
      const sessions = await database.query(`
        SELECT 
          session_id,
          session_token,
          created_at,
          expires_at,
          last_activity,
          CASE WHEN expires_at > GETDATE() THEN 1 ELSE 0 END as is_active
        FROM User_Sessions
        WHERE user_id = @userId
        AND created_at > DATEADD(day, -30, GETDATE())
        ORDER BY created_at DESC
      `, { userId: userId.toString() });

      return sessions;
    } catch (error) {
      console.error('Error getting user sessions:', error);
      return [];
    }
  }

  // Terminate specific session (admin function)
  static async terminateSession(sessionId) {
    try {
      console.log(`Terminating session with ID: ${sessionId}`);
      
      // First check if session exists
      const existingSession = await database.query(`
        SELECT session_id FROM User_Sessions 
        WHERE session_id = @sessionId AND expires_at > GETDATE()
      `, { sessionId });

      if (!existingSession || existingSession.length === 0) {
        console.log(`Session ${sessionId} not found or already expired`);
        return false;
      }

      // Update the session to expire it
      await database.query(`
        UPDATE User_Sessions 
        SET expires_at = GETDATE()
        WHERE session_id = @sessionId
      `, { sessionId });

      console.log(`Session ${sessionId} terminated successfully`);
      return true;
    } catch (error) {
      console.error('Error terminating session:', error);
      console.error('Error details:', error.message);
      return false;
    }
  }

  // Clean up expired sessions (older than 7 days)
  static async cleanupExpiredSessions() {
    try {
      await database.query(`
        DELETE FROM User_Sessions 
        WHERE expires_at < DATEADD(day, -7, GETDATE())
      `);
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
    }
  }

  // Get session statistics for admin dashboard
  static async getSessionStats() {
    try {
      const stats = await database.query(`
        SELECT 
          COUNT(CASE WHEN expires_at > GETDATE() THEN 1 END) as active_sessions,
          COUNT(CASE WHEN created_at > DATEADD(hour, -24, GETDATE()) THEN 1 END) as sessions_24h,
          COUNT(CASE WHEN created_at > DATEADD(day, -7, GETDATE()) THEN 1 END) as sessions_7d,
          COUNT(DISTINCT CASE WHEN expires_at > GETDATE() THEN user_id END) as active_users,
          COUNT(DISTINCT user_id) as total_users_with_sessions
        FROM User_Sessions
        WHERE created_at > DATEADD(day, -30, GETDATE())
      `);

      return stats[0] || {
        active_sessions: 0,
        sessions_24h: 0,
        sessions_7d: 0,
        active_users: 0,
        total_users_with_sessions: 0
      };
    } catch (error) {
      console.error('Error getting session stats:', error);
      return {
        active_sessions: 0,
        sessions_24h: 0,
        sessions_7d: 0,
        active_users: 0,
        total_users_with_sessions: 0
      };
    }
  }
}

export default SessionManager;