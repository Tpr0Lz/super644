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
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  }
}
