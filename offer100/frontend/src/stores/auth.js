import { defineStore } from 'pinia';

const STORAGE_KEY = 'offer100_auth';

function loadFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { token: '', user: null, activeIdentity: 'jobseeker' };
  }
  try {
    const parsed = JSON.parse(raw);
    const user =
      parsed.user ||
      (parsed.username
        ? {
            id: parsed.uid || parsed.id,
            username: parsed.username,
            nickname: parsed.nickname || parsed.username,
            identities: parsed.identities || []
          }
        : null);
    const token = parsed.token === 'test-token' ? '' : parsed.token || '';
    if (!token) {
      localStorage.removeItem(STORAGE_KEY);
      return { token: '', user: null, activeIdentity: 'jobseeker' };
    }
    return {
      token,
      user,
      activeIdentity:
        parsed.activeIdentity ||
        user?.initialIdentity ||
        user?.identities?.[0] ||
        'jobseeker'
    };
  } catch (error) {
    localStorage.removeItem(STORAGE_KEY);
    return { token: '', user: null, activeIdentity: 'jobseeker' };
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: '',
    user: null,
    activeIdentity: 'jobseeker',
    ...loadFromStorage()
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.token && state.user?.username),
    identities: (state) => state.user?.identities || [],
    role: (state) => state.activeIdentity
  },
  actions: {
    persist() {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ token: this.token, user: this.user, activeIdentity: this.activeIdentity })
      );
    },
    setAuth(payload) {
      this.token = payload.token;
      this.user = payload.user || (payload.username ? { id: payload.uid || payload.id, username: payload.username } : null);
      if (this.user && this.user.username === 'adm') {
        this.user.identities = ['admin'];
        this.activeIdentity = 'admin';
      } else {
        this.activeIdentity =
          this.user?.initialIdentity || this.user?.identities?.[0] || 'jobseeker';
      }
      this.persist();
    },
    setUserIdentities(identities) {
      if (!this.user) {
        return;
      }
      this.user = {
        ...this.user,
        identities: Array.isArray(identities) ? identities : this.user.identities || []
      };
      if (!this.user.identities.includes(this.activeIdentity)) {
        this.activeIdentity = this.user.identities[0] || 'jobseeker';
      }
      this.persist();
    },
    setActiveIdentity(identity) {
      if (this.identities.includes(identity)) {
        this.activeIdentity = identity;
        this.persist();
      }
    },
    logout() {
      this.token = '';
      this.user = null;
      this.activeIdentity = 'jobseeker';
      localStorage.removeItem(STORAGE_KEY);
    }
  }
});
