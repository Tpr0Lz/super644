<template>
  <RouterView v-slot="{ Component, route }">
    <KeepAlive>
      <component :is="Component" v-if="route.meta.keepAlive" :key="route.name" />
    </KeepAlive>
    <component :is="Component" v-if="!route.meta.keepAlive" :key="route.fullPath" />
  </RouterView>
</template>

<script setup>
import { KeepAlive } from 'vue';
import { RouterView } from 'vue-router';
</script>
