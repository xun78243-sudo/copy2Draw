<script setup lang="ts">
import AppIcon from '@/components/base/AppIcon.vue'

const SUBMIT_EMAIL = 'copy2draw@gmail.com'
const MAIL_SUBJECT = '投稿 + 分类'
const mailto = `mailto:${SUBMIT_EMAIL}?subject=${encodeURIComponent(MAIL_SUBJECT)}`
</script>

<template>
  <div id="library" class="content">
    <div class="mx-auto max-w-3xl py-14 sm:py-20">
      <header class="text-center">
        <p class="text-xs font-bold uppercase tracking-[0.22em] text-violet-600">Submit your prompt</p>
        <h1 class="mt-4 text-3xl font-bold tracking-tight text-zinc-900 sm:text-5xl">投稿好提示词</h1>
        <p class="mx-auto mt-4 max-w-xl text-sm leading-7 text-zinc-500">
          你的灵感会进入复制即画的审核花园，被更多人看到、复制、使用，并生长为新的画面。
        </p>
      </header>

      <section class="my-9 rounded-2xl border border-violet-100 bg-violet-50/70 p-5 sm:p-6">
        <h2 class="text-sm font-bold text-zinc-900">投稿须知</h2>
        <ul class="mt-3 space-y-2 text-sm leading-6 text-zinc-600">
          <li><b class="text-zinc-800">内容：</b>请提交完整、表达清晰且经过出图验证的 AI 图像提示词。</li>
          <li><b class="text-zinc-800">预览：</b>建议提供 1–2 张效果图，帮助我们准确归档和展示。</li>
          <li><b class="text-zinc-800">原创：</b>原创优先；转载内容请注明来源，版权归原作者所有。</li>
          <li><b class="text-zinc-800">审核：</b>我们会筛选可复用的优质内容，通常在 3–5 个工作日内完成。</li>
        </ul>
      </section>

      <section class="mail-card">
        <span class="mail-icon"><AppIcon name="send" :size="22" /></span>
        <h2>发送到投稿邮箱</h2>
        <p>把提示词 + 预览图发到下方邮箱，标题写「投稿 + 分类」即可。</p>
        <a :href="mailto">{{ SUBMIT_EMAIL }}</a>
      </section>
    </div>
  </div>
</template>
