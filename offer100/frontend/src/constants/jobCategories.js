import { ref } from 'vue';
import http from '../api/http';

export const JOB_CATEGORY_TREE = ref([]);

export async function loadCategories() {
  if (JOB_CATEGORY_TREE.value.length === 0) {
    try {
      const { data } = await http.get('/jobs/categories');
      // Format flat list [{ id, category_l1, category_l2 }, ...] into { value: l1, label: l1, children: [l2,...] }
      const treeMap = {};
      (data || []).forEach(item => {
        if (!treeMap[item.category_l1]) {
          treeMap[item.category_l1] = {
            value: item.category_l1,
            label: item.category_l1,
            children: []
          };
        }
        if (item.category_l2 && !treeMap[item.category_l1].children.includes(item.category_l2)) {
          treeMap[item.category_l1].children.push(item.category_l2);
        }
      });
      JOB_CATEGORY_TREE.value = Object.values(treeMap);

      // Fallback: when job_categories table is empty, derive categories from current jobs.
      if (JOB_CATEGORY_TREE.value.length === 0) {
        const { data: jobs } = await http.get('/jobs');
        const fallbackMap = {};
        (Array.isArray(jobs) ? jobs : []).forEach((job) => {
          const l1 = String(job?.categoryL1 || '').trim();
          const l2 = String(job?.categoryL2 || '').trim();
          if (!l1) {
            return;
          }
          if (!fallbackMap[l1]) {
            fallbackMap[l1] = {
              value: l1,
              label: l1,
              children: []
            };
          }
          if (l2 && !fallbackMap[l1].children.includes(l2)) {
            fallbackMap[l1].children.push(l2);
          }
        });
        JOB_CATEGORY_TREE.value = Object.values(fallbackMap);
      }
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  }
}
