/**
 * API 
 * API Utility Module
 */

const API = {
    baseURL: '/api',
    
    /**
     * 
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const fetchOptions = { method: 'GET', ...options };
        fetchOptions.headers = { ...(fetchOptions.headers || {}) };
        const isFormData = fetchOptions.body instanceof FormData;

        if (isFormData) {
            delete fetchOptions.headers['Content-Type'];
        } else if (fetchOptions.body && typeof fetchOptions.body !== 'string') {
            fetchOptions.headers['Content-Type'] = fetchOptions.headers['Content-Type'] || 'application/json';
            fetchOptions.body = JSON.stringify(fetchOptions.body);
        } else if (!fetchOptions.body && !isFormData && !fetchOptions.headers['Content-Type']) {
            // No body provided; leave Content-Type unset for GET/DELETE requests
        }
        
        try {
            const response = await fetch(url, fetchOptions);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API:', error);
            throw error;
        }
    },
    
    /**
     * GET 
     */
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    },
    
    /**
     * POST 
     */
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: data
        });
    },
    
    /**
     * PUT 
     */
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: data
        });
    },
    
    /**
     * DELETE 
     */
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    },
    
    // =====  =====
    async getCommunities() {
        return this.get('/communities');
    },
    
    async getCommunity(id) {
        return this.get(`/communities/${id}`);
    },
    
    // =====  =====
    async getListings(params = {}) {
        return this.get('/listings', params);
    },
    
    async getListing(id) {
        return this.get(`/listings/${id}`);
    },
    
    async createListing(data) {
        if (data instanceof FormData) {
            return this.request('/listings', {
                method: 'POST',
                body: data
            });
        }
        return this.post('/listings', data);
    },
    
    async updateListing(id, data) {
        return this.put(`/listings/${id}`, data);
    },
    
    async searchListings(query, params = {}) {
        return this.get('/listings/search', { q: query, ...params });
    },
    
    // =====  =====
    async getUser(id) {
        return this.get(`/users/${id}`);
    },
    
    async createUser(data) {
        return this.post('/users', data);
    },
    
    async verifyUser(id, status) {
        return this.post(`/users/${id}/verify`, { status });
    },
    
    async getUserListings(userId, params = {}) {
        return this.get(`/users/${userId}/listings`, params);
    },
    
    async getUserFavorites(userId, params = {}) {
        return this.get(`/users/${userId}/favorites`, params);
    },

    async uploadAvatar(userId, file) {
        const formData = new FormData();
        formData.append('avatar', file);
        return this.request(`/users/${userId}/avatar`, {
            method: 'POST',
            body: formData
        });
    },
    
    async addFavorite(data) {
        return this.post('/favorites', data);
    },
    
    async removeFavorite(userId, listingId) {
        return this.request(`/favorites/${listingId}?user_id=${userId}`, {
            method: 'DELETE'
        });
    },
    
    // =====  =====
    async getThreads(userId) {
        return this.get(`/threads/${userId}`);
    },
    
    async createThread(data) {
        return this.post('/threads', data);
    },
    
    async getMessages(threadId) {
        return this.get(`/threads/${threadId}/messages`);
    },
    
    async sendMessage(data) {
        return this.post('/messages', data);
    },
    
    async getUnreadCount(userId) {
        return this.get(`/messages/${userId}/unread-count`);
    },
    
    // ===== Report =====
    async createReport(data) {
        return this.post('/reports', data);
    },
    
    async getReports() {
        return this.get('/reports');
    },
    
    // =====  =====
    async createReview(data) {
        return this.post('/reviews', data);
    },
    
    async getUserReviews(userId) {
        return this.get(`/users/${userId}/reviews`);
    },
    
    async getRatingStats(userId) {
        return this.get(`/users/${userId}/rating-stats`);
    },
    
    // =====  =====
    async getDashboardStats() {
        return this.get('/stats/dashboard');
    },
    
    async getCategoryStats() {
        return this.get('/stats/categories');
    }
};

// 
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}
