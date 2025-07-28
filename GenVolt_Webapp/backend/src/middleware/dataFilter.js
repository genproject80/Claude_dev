import database from '../config/database.js';

/**
 * Data isolation middleware - filters data based on user's role and client assignments
 * This ensures users only see data they're authorized to access
 */

/**
 * Get user's accessible client IDs based on their role and assignments
 * @param {string} userId - User ID
 * @param {string} userRole - User role
 * @param {string} userClientId - User's assigned client ID
 * @returns {Promise<Array>} - Array of accessible client IDs
 */
export const getUserAccessibleClientIds = async (userId, userRole, userClientId) => {
  // Admin users can access all clients
  if (userRole === 'admin') {
    const allClients = await database.query(`
      SELECT DISTINCT client_id 
      FROM device 
      WHERE client_id IS NOT NULL AND client_id != ''
    `);
    return allClients.map(c => c.client_id);
  }

  // For non-admin users, return only their assigned client
  if (userClientId) {
    return [userClientId];
  }

  // If no client assignment, return empty array (no access)
  return [];
};

/**
 * Build SQL WHERE clause for client filtering
 * @param {Array} clientIds - Array of accessible client IDs
 * @param {string} tableAlias - Table alias for the query (e.g., 'd' for device table)
 * @returns {Object} - {whereClause, params}
 */
export const buildClientFilter = (clientIds, tableAlias = '') => {
  if (!clientIds || clientIds.length === 0) {
    // No access - return impossible condition
    return {
      whereClause: '1 = 0',
      params: {}
    };
  }

  const prefix = tableAlias ? `${tableAlias}.` : '';
  
  if (clientIds.length === 1) {
    return {
      whereClause: `${prefix}client_id = @clientId`,
      params: { clientId: clientIds[0] }
    };
  }

  // Multiple client IDs - use IN clause
  const placeholders = clientIds.map((_, index) => `@clientId${index}`).join(', ');
  const params = {};
  clientIds.forEach((clientId, index) => {
    params[`clientId${index}`] = clientId;
  });

  return {
    whereClause: `${prefix}client_id IN (${placeholders})`,
    params
  };
};

/**
 * Middleware to add client filtering to requests
 * Adds req.dataFilter with user's accessible client IDs and filter utilities
 */
export const addDataFilter = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id: userId, role: userRole } = req.user;
    
    // Get user's client assignment from database
    const userDetails = await database.query(
      'SELECT client_id FROM users WHERE id = @userId',
      { userId }
    );

    const userClientId = userDetails[0]?.client_id;
    
    // Get accessible client IDs
    const accessibleClientIds = await getUserAccessibleClientIds(userId, userRole, userClientId);
    
    // Add data filter utilities to request
    req.dataFilter = {
      userId,
      userRole,
      userClientId,
      accessibleClientIds,
      hasAccess: accessibleClientIds.length > 0,
      isAdmin: userRole === 'admin',
      
      // Utility function to build client filter for queries
      buildClientFilter: (tableAlias = '') => buildClientFilter(accessibleClientIds, tableAlias),
      
      // Utility function to check if user can access specific client
      canAccessClient: (clientId) => {
        if (userRole === 'admin') return true;
        return accessibleClientIds.includes(clientId);
      }
    };

    next();
  } catch (error) {
    console.error('Error in data filter middleware:', error);
    res.status(500).json({ error: 'Failed to apply data filtering' });
  }
};

/**
 * Middleware to enforce data access - blocks request if user has no data access
 */
export const requireDataAccess = (req, res, next) => {
  if (!req.dataFilter) {
    return res.status(500).json({ error: 'Data filter not initialized' });
  }

  if (!req.dataFilter.hasAccess) {
    return res.status(403).json({ 
      error: 'No data access. Please contact an administrator to assign you to a client.' 
    });
  }

  next();
};

/**
 * Utility function to add client filtering to any SQL query
 * @param {string} query - Original SQL query
 * @param {Object} dataFilter - Data filter from req.dataFilter
 * @param {string} tableAlias - Table alias that contains client_id column
 * @returns {Object} - {query: modifiedQuery, params: additionalParams}
 */
export const addClientFilterToQuery = (query, dataFilter, tableAlias = 'd') => {
  if (dataFilter.isAdmin) {
    // Admin can see all data - no filtering needed
    return { query, params: {} };
  }

  const { whereClause, params } = dataFilter.buildClientFilter(tableAlias);
  
  // Check if query already has WHERE clause
  const hasWhere = /\bWHERE\b/i.test(query);
  
  if (hasWhere) {
    // Add to existing WHERE clause
    const modifiedQuery = query.replace(/\bWHERE\b/i, `WHERE ${whereClause} AND`);
    return { query: modifiedQuery, params };
  } else {
    // Add new WHERE clause before ORDER BY, GROUP BY, or HAVING
    const modifiedQuery = query.replace(
      /\b(ORDER\s+BY|GROUP\s+BY|HAVING)\b/i,
      `WHERE ${whereClause} $1`
    );
    
    // If no ORDER BY, GROUP BY, or HAVING found, append WHERE clause
    if (modifiedQuery === query) {
      return { query: `${query} WHERE ${whereClause}`, params };
    }
    
    return { query: modifiedQuery, params };
  }
};

export default {
  addDataFilter,
  requireDataAccess,
  getUserAccessibleClientIds,
  buildClientFilter,
  addClientFilterToQuery
};