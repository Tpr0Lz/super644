import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import LoginView from '../views/LoginView.vue';
import HomeView from '../views/HomeView.vue';
import HomeOverviewView from '../views/home/HomeOverviewView.vue';
import HomePublishJobView from '../views/home/HomePublishJobView.vue';
import JobDetailView from '../views/JobDetailView.vue';
import RecruiterDashboard from '../views/RecruiterDashboard.vue';
import SeekerDashboard from '../views/SeekerDashboard.vue';
import SeekerDetailView from '../views/SeekerDetailView.vue';
import ChatView from '../views/ChatView.vue';
import ProfileView from '../views/ProfileView.vue';
import IdentityRegisterView from '../views/IdentityRegisterView.vue';

const routes = [
  { path: '/login', name: 'login', component: LoginView },
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'home-overview',
        component: HomeOverviewView,
        meta: { requiresAuth: true }
      },
      {
        path: 'publish',
        name: 'home-publish',
        component: HomePublishJobView,
        meta: { requiresAuth: true, identity: 'recruiter' }
      }
    ]
  },
  {
    path: '/jobs',
    name: 'jobs',
    redirect: '/',
    meta: { requiresAuth: true }
  },
  {
    path: '/jobs/:id',
    name: 'job-detail',
    component: JobDetailView,
    meta: { requiresAuth: true }
  },
  {
    path: '/recruiter',
    name: 'recruiter',
    component: RecruiterDashboard,
    meta: { requiresAuth: true, identity: 'recruiter' }
  },
  {
    path: '/seeker',
    name: 'seeker',
    component: SeekerDashboard,
    meta: { requiresAuth: true, identity: 'jobseeker' }
  },
  {
    path: '/seekers/:userId',
    name: 'seeker-detail',
    component: SeekerDetailView,
    meta: { requiresAuth: true, identity: 'recruiter' }
  },
  {
    path: '/chat',
    name: 'chat',
    component: ChatView,
    meta: { requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfileView,
    meta: { requiresAuth: true }
  },
  {
    path: '/identity-register',
    name: 'identity-register',
    component: IdentityRegisterView,
    meta: { requiresAuth: true }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    return '/login';
  }

  if (to.path === '/login' && authStore.isLoggedIn) {
    return '/';
  }

  if (to.meta.identity && authStore.activeIdentity !== to.meta.identity) {
    return '/';
  }

  return true;
});

export default router;
