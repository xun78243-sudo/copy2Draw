<script setup lang="ts">
import AppIcon from './base/AppIcon.vue'
import AppLogo from './base/AppLogo.vue'
</script>

<template>
  <header class="detail-nav">
    <div class="detail-nav-inner">
      <AppLogo />

      <nav class="detail-nav-links" aria-label="主要导航">
        <RouterLink class="detail-nav-link" to="/">每日精选</RouterLink>
        <RouterLink class="detail-nav-link is-active" to="/discover">发现提示词</RouterLink>
      </nav>

      <RouterLink class="detail-nav-submit" to="/submit">
        <AppIcon name="send" :size="15" />
        <span>投稿</span>
      </RouterLink>
    </div>
  </header>
</template>
