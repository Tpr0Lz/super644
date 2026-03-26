import { ref } from 'vue';
import http from '../api/http';

export const JOB_CATEGORY_TREE = ref([]);

export async function loadCategories() {
  if (JOB_CATEGORY_TREE.value.length === 0) {
    try {
      const { data } = await http.get('/jobs/categories');
      JOB_CATEGORY_TREE.value = data || [];
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  }
}
