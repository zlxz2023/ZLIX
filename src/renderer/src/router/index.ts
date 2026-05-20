import {
    createRouter,
    createWebHashHistory,
    type RouteLocationNormalized,
    type RouteRecordRaw,
} from 'vue-router';

const routes: RouteRecordRaw[] = [
    {
        path: '/',
        name: 'loading',
        component: () => import('@renderer/views/Loading.vue'),
        meta: { skipHistory: true },
    },
    {
        path: '/lyrics',
        name: 'lyrics',
        component: () => import('@renderer/views/LyricsWindow.vue'),
        meta: { skipHistory: true },
    },
    {
        path: '/main',
        component: () => import('@renderer/layouts/MainLayout.vue'),
        children: [
            {
                path: 'home',
                name: 'home',
                component: () => import('@renderer/views/Home.vue'),
            },
            {
                path: 'discover',
                name: 'discover',
                component: () => import('@renderer/views/Discover.vue'),
            },
            {
                path: 'search',
                name: 'search',
                component: () => import('@renderer/views/Search.vue'),
            },
            {
                path: 'playlist/:id',
                name: 'playlist-detail',
                component: () => import('@renderer/views/PlaylistDetail.vue'),
            },
            {
                path: 'artist/:id',
                name: 'artist-detail',
                component: () => import('@renderer/views/ArtistDetail.vue'),
            },
            {
                path: 'album/:id',
                name: 'album-detail',
                component: () => import('@renderer/views/AlbumDetail.vue'),
            },
            {
                path: 'recent',
                name: 'recent',
                component: () => import('@renderer/views/RecentPlay.vue'),
            },
            {
                path: 'playlists',
                name: 'playlists',
                component: () => import('@renderer/views/MyPlaylists.vue'),
            },
            {
                path: 'favorites',
                name: 'favorites',
                component: () => import('@renderer/views/Favorites.vue'),
            },
        ],
    },
];

const router = createRouter({
    history: createWebHashHistory(),
    routes,
});

const shouldSkipHistory = (route: RouteLocationNormalized): boolean => {
    return route.matched.some((record) => record.meta?.skipHistory === true);
};

router.beforeEach((to, from) => {
    const skipToHistory = shouldSkipHistory(to);
    const skipFromHistory = from.matched.length > 0 && shouldSkipHistory(from);

    if ((!skipToHistory && !skipFromHistory) || to.redirectedFrom) return true;

    return {
        ...to,
        replace: true,
    };
});

export default router;