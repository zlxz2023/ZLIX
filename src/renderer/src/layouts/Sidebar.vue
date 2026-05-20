<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@renderer/stores/user'
import { useDeviceStore } from '@renderer/stores/device'
import LoginModal from '@renderer/components/LoginModal.vue'
import UserCenterModal from '@renderer/components/UserCenterModal.vue'
import HomeIcon from '@renderer/assets/icons/sidebar/home.svg'
import DiscIcon from '@renderer/assets/icons/sidebar/discover.svg'
import RecentIcon from '@renderer/assets/icons/sidebar/recent.svg'
import PlaylistIcon from '@renderer/assets/icons/sidebar/playlist.svg'
import FavoriteIcon from '@renderer/assets/icons/sidebar/favorite.svg'

const router = useRouter()
const userStore = useUserStore()
const deviceStore = useDeviceStore()
const activeItem = ref('/main/home')
const loginModalRef = ref<InstanceType<typeof LoginModal> | null>(null)
const userCenterModalRef = ref<InstanceType<typeof UserCenterModal> | null>(null)
const menuItems = [
    { name: '为我推荐', icon: HomeIcon, path: '/main/home' },
    { name: '发现音乐', icon: DiscIcon, path: '/main/discover' },
    { name: '最近播放', icon: RecentIcon, path: '/main/recent' },
    { name: '自建歌单', icon: PlaylistIcon, path: '/main/playlists' },
    { name: '收藏歌单', icon: FavoriteIcon, path: '/main/favorites' }
]
const navigateTo = (path: string) => {
    activeItem.value = path
    router.push(path)
}
const handleUserClick = () => {
    if (userStore.isLoggedIn) {
        userCenterModalRef.value?.show()
    } else {
        loginModalRef.value?.show()
    }
}
const getNickname = () => {
    return userStore.info?.nickname || userStore.info?.username || '未登录'
}
const getUserLevel = () => {
    const pGrade = userStore.info?.p_grade
    if (pGrade && pGrade > 0) {
        return `Lv.${pGrade}`
    }
    return ''
}
const getUserPic = () => {
    const pic = userStore.info?.pic || ''
    if (pic && pic.startsWith('http://')) {
        return pic.replace('http://', 'https://')
    }
    return pic
}
watch(
    () => userStore.isLoggedIn,
    () => {
        if (userStore.isLoggedIn) {
            userStore.fetchUserInfoOnce()
        }
    }
)
onMounted(async () => {
    await deviceStore.registerDevice()
    if (userStore.isLoggedIn) {
        await userStore.fetchUserInfoOnce()
    }
})
</script>

<template>
    <aside class="w-66 bg-secondary flex flex-col h-full border-r border-theme-light select-none">
        <!-- 用户信息 -->
        <div class="px-4 pt-8">
            <div
                class="border border-gray-200 rounded-xl cursor-pointer transition-all duration-200 hover:scale-105 hover:border-gray-300"
                @click="handleUserClick"
            >
                <div
                    class="flex items-center gap-3 p-3 rounded-xl hover:bg-hover transition-all duration-200"
                >
                    <div
                        class="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 overflow-hidden"
                    >
                        <img
                            v-if="getUserPic()"
                            :src="getUserPic()"
                            alt="头像"
                            class="w-full h-full object-cover"
                        />
                        <span v-else class="text-white text-xl font-bold">{{
                            getNickname().charAt(0)
                        }}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="font-medium text-primary truncate">{{ getNickname() }}</p>
                        <p v-if="getUserLevel()" class="text-sm text-secondary">
                            {{ getUserLevel() }}
                        </p>
                        <p v-else-if="!userStore.isLoggedIn" class="text-sm text-muted">点击登录</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- 菜单 -->
        <nav class="flex-1 py-4">
            <!-- 发现音乐 -->
            <p class="px-[20px] py-2 text-xs text-muted font-medium">发现音乐</p>
            <div
                v-for="item in menuItems.slice(0, 2)"
                :key="item.name"
                class="flex items-center gap-4 pl-[20px] py-4 mx-3 h-14 rounded-lg cursor-pointer transition-all duration-200"
                :class="
                    activeItem === item.path
                        ? 'bg-active text-primary scale-105'
                        : 'text-secondary hover:bg-hover hover:text-primary hover:scale-105'
                "
                @click="navigateTo(item.path)"
            >
                <img :src="item.icon" class="w-5 h-5" />
                <span class="font-medium">{{ item.name }}</span>
            </div>

            <!-- 我的音乐 -->
            <p class="px-[20px] py-2 mt-4 text-xs text-muted font-medium">我的音乐</p>
            <div
                v-for="item in menuItems.slice(2)"
                :key="item.name"
                class="flex items-center gap-4 pl-[20px] py-4 mx-3 h-14 rounded-lg cursor-pointer transition-all duration-200"
                :class="
                    activeItem === item.path
                        ? 'bg-active text-primary scale-105'
                        : 'text-secondary hover:bg-hover hover:text-primary hover:scale-105'
                "
                @click="navigateTo(item.path)"
            >
                <img :src="item.icon" class="w-5 h-5" />
                <span class="font-medium">{{ item.name }}</span>
            </div>
        </nav>
    </aside>

    <!-- 登录弹窗 -->
    <LoginModal ref="loginModalRef" />

    <!-- 个人中心弹窗 -->
    <UserCenterModal ref="userCenterModalRef" />
</template>