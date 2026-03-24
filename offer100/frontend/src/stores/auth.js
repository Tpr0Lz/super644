import { defineStore } from 'pinia';

const STORAGE_KEY = 'offer100_auth';

function loadFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { token: '', user: null, activeIdentity: 'jobseeker' };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      token: parsed.token || '',
      user: parsed.user || null,
      activeIdentity:
        parsed.activeIdentity ||
        parsed.user?.initialIdentity ||
        parsed.user?.identities?.[0] ||
        'jobseeker'
    };
  } catch (error) {
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
    isLoggedIn: (state) => Boolean(state.token),
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
      this.user = payload.user;
      this.activeIdentity =
        payload.user?.initialIdentity || payload.user?.identities?.[0] || 'jobseeker';
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
