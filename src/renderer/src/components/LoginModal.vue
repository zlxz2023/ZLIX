<script setup lang="ts">
import { ref, onUnmounted, watch } from 'vue'
import { useUserStore } from '@renderer/stores/user'
import { useDeviceStore } from '@renderer/stores/device'
import {
    getLoginQrKey,
    checkLoginQr,
    sendSmsCode,
    loginBySms,
    createWxLogin,
    checkWxLogin,
    loginByOpenPlat
} from '@renderer/api/kugou/user'
import { logger } from '@renderer/utils/logger'

const emit = defineEmits<{
    (e: 'close'): void
}>()

const userStore = useUserStore()
const deviceStore = useDeviceStore()

const isVisible = ref(false)
const loginMethod = ref<'qr' | 'sms' | 'wx'>('qr')
const qrImage = ref('')
const qrKey = ref('')
const qrStatus = ref<'loading' | 'ready' | 'scanned' | 'success' | 'expired'>('loading')
const qrTimer = ref<number | null>(null)

const wxQrImage = ref('')
const wxUuid = ref('')
const wxStatus = ref<'loading' | 'ready' | 'scanned' | 'success' | 'expired'>('loading')
const wxTimer = ref<number | null>(null)

const mobile = ref('')
const smsCode = ref('')
const isSendingCode = ref(false)
const smsCountdown = ref(0)
const smsTimer = ref<number | null>(null)
const smsStatus = ref<'idle' | 'loading' | 'success'>('idle')

const errorMessage = ref('')

const show = () => {
    isVisible.value = true
    loginMethod.value = 'qr'
    errorMessage.value = ''
    initQrLogin()
}

const hide = () => {
    isVisible.value = false
    stopQrPolling()
    stopSmsCountdown()
}

const emitClose = () => {
    emit('close')
    hide()
}

const initQrLogin = async () => {
    try {
        qrStatus.value = 'loading'
        await deviceStore.ensureDeviceInfo()

        const keyRes = await getLoginQrKey()
        if (keyRes && keyRes.status === 1 && keyRes.data?.qrcode && keyRes.data?.qrcode_img) {
            qrKey.value = keyRes.data.qrcode
            qrImage.value = keyRes.data.qrcode_img
            qrStatus.value = 'ready'
            startQrPolling()
        } else {
            throw new Error('Failed to get QR key')
        }
    } catch (e: any) {
        logger.error('LoginModal', '初始化扫码登录失败', e)
        errorMessage.value = '获取二维码失败，请重试'
        qrStatus.value = 'expired'
    }
}

const startQrPolling = () => {
    stopQrPolling()
    const poll = async () => {
        if (qrStatus.value !== 'ready' && qrStatus.value !== 'scanned') return

        try {
            const res = await checkLoginQr(qrKey.value)
            if (res && res.data) {
                const status = res.data.status
                if (status === 800) {
                    qrStatus.value = 'expired'
                } else if (status === 801) {
                    qrStatus.value = 'ready'
                } else if (status === 802) {
                    qrStatus.value = 'scanned'
                } else if (status === 803) {
                    qrStatus.value = 'success'
                    stopQrPolling()
                    userStore.handleLoginSuccess(res.data)
                    await userStore.fetchUserInfoOnce()
                    emitClose()
                }
            }
        } catch (e: any) {
            logger.error('LoginModal', '扫码登录轮询失败', e)
        }

        if (qrStatus.value === 'ready' || qrStatus.value === 'scanned') {
            qrTimer.value = window.setTimeout(poll, 2000)
        }
    }
    poll()
}

const stopQrPolling = () => {
    if (qrTimer.value) {
        clearTimeout(qrTimer.value)
        qrTimer.value = null
    }
}

const refreshQr = () => {
    initQrLogin()
}

const initWxLogin = async () => {
    try {
        wxStatus.value = 'loading'
        await deviceStore.ensureDeviceInfo()

        const res = await createWxLogin()
        const hasErrcode = res && res.errcode === 0
        const hasUuid = res && res.uuid
        const hasQrcodeBase64 =
            res && res.qrcode && typeof res.qrcode === 'object' && res.qrcode.qrcodebase64

        if (hasErrcode && hasUuid && hasQrcodeBase64) {
            wxUuid.value = res.uuid
            wxQrImage.value = 'data:image/png;base64,' + res.qrcode.qrcodebase64
            wxStatus.value = 'ready'
            startWxPolling()
        } else {
            throw new Error('Failed to create WX login - missing required fields')
        }
    } catch (e: any) {
        logger.error('LoginModal', '初始化微信登录失败', e)
        errorMessage.value = '获取微信二维码失败，请重试'
        wxStatus.value = 'expired'
    }
}

const startWxPolling = () => {
    stopWxPolling()
    const poll = async () => {
        if (wxStatus.value !== 'ready' && wxStatus.value !== 'scanned') return

        try {
            const res = await checkWxLogin(wxUuid.value, Date.now())

            if (res && res.wx_errcode === 405 && res.wx_code) {
                wxStatus.value = 'success'
                stopWxPolling()
                const loginRes = await loginByOpenPlat(res.wx_code)
                if (loginRes && loginRes.status === 1 && loginRes.data) {
                    userStore.handleLoginSuccess(loginRes.data)
                    await userStore.fetchUserInfoOnce()
                    emitClose()
                }
            } else if (res && res.status === 1 && res.data) {
                const status = res.data.status
                if (status === 800) {
                    wxStatus.value = 'expired'
                } else if (status === 801) {
                    wxStatus.value = 'ready'
                } else if (status === 802) {
                    wxStatus.value = 'scanned'
                } else if (status === 803) {
                    wxStatus.value = 'success'
                    stopWxPolling()
                    const code = res.data.code
                    if (code) {
                        const loginRes = await loginByOpenPlat(code)
                        if (loginRes && loginRes.status === 1 && loginRes.data) {
                            userStore.handleLoginSuccess(loginRes.data)
                            await userStore.fetchUserInfoOnce()
                            emitClose()
                        }
                    }
                }
            }
        } catch (e: any) {
            logger.error('LoginModal', '微信登录轮询失败', e)
        }

        if (wxStatus.value === 'ready' || wxStatus.value === 'scanned') {
            wxTimer.value = window.setTimeout(poll, 2000)
        }
    }
    poll()
}

const stopWxPolling = () => {
    if (wxTimer.value) {
        clearTimeout(wxTimer.value)
        wxTimer.value = null
    }
}

const refreshWx = () => {
    initWxLogin()
}

const handleSendSms = async () => {
    if (!mobile.value || mobile.value.length !== 11) {
        errorMessage.value = '请输入正确的手机号码'
        return
    }

    try {
        isSendingCode.value = true
        const res = await sendSmsCode(mobile.value)
        if (res && res.status === 1) {
            errorMessage.value = ''
            smsCountdown.value = 60
            startSmsCountdown()
        } else {
            errorMessage.value = res?.msg || '发送验证码失败'
        }
    } catch (e: any) {
        logger.error('LoginModal', '发送验证码失败', e)
        errorMessage.value = '发送验证码失败'
    } finally {
        isSendingCode.value = false
    }
}

const startSmsCountdown = () => {
    stopSmsCountdown()
    const countdown = () => {
        smsCountdown.value--
        if (smsCountdown.value > 0) {
            smsTimer.value = window.setTimeout(countdown, 1000)
        }
    }
    countdown()
}

const stopSmsCountdown = () => {
    if (smsTimer.value) {
        clearTimeout(smsTimer.value)
        smsTimer.value = null
    }
}

const handleSmsLogin = async () => {
    if (!mobile.value || mobile.value.length !== 11) {
        errorMessage.value = '请输入正确的手机号码'
        return
    }
    if (!smsCode.value || smsCode.value.length !== 6) {
        errorMessage.value = '请输入6位验证码'
        return
    }

    smsStatus.value = 'loading'
    try {
        const res = await loginBySms(mobile.value, smsCode.value)
        if (res && res.status === 1 && res.data) {
            smsStatus.value = 'success'
            userStore.handleLoginSuccess(res.data)
            await userStore.fetchUserInfoOnce()
            emitClose()
        } else {
            smsStatus.value = 'idle'
            errorMessage.value = res?.msg || '登录失败'
        }
    } catch (e: any) {
        smsStatus.value = 'idle'
        logger.error('LoginModal', '短信登录失败', e)
        errorMessage.value = '登录失败'
    }
}

watch(loginMethod, () => {
    errorMessage.value = ''
    stopQrPolling()
    stopWxPolling()

    if (loginMethod.value === 'qr') {
        initQrLogin()
    } else if (loginMethod.value === 'wx') {
        initWxLogin()
    }
})

onUnmounted(() => {
    stopQrPolling()
    stopWxPolling()
    stopSmsCountdown()
})

defineExpose({ show, hide })
</script>

<template>
    <Teleport to="body">
        <div v-if="isVisible" class="login-modal-overlay" @click.self="emitClose">
            <div class="login-modal">
                <div class="login-modal-header">
                    <h2>登录账号</h2>
                    <button class="close-btn" @click="emitClose">×</button>
                </div>

                <div class="login-tabs">
                    <button
                        :class="['tab-btn', { active: loginMethod === 'qr' }]"
                        @click="loginMethod = 'qr'"
                    >
                        扫码登录
                    </button>
                    <button
                        :class="['tab-btn', { active: loginMethod === 'wx' }]"
                        @click="loginMethod = 'wx'"
                    >
                        微信登录
                    </button>
                    <button
                        :class="['tab-btn', { active: loginMethod === 'sms' }]"
                        @click="loginMethod = 'sms'"
                    >
                        短信登录
                    </button>
                </div>

                <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

                <div v-if="loginMethod === 'qr'" class="qr-login">
                    <div v-if="qrStatus === 'loading'" class="loading">
                        <div class="spinner"></div>
                        <p>正在获取二维码...</p>
                    </div>

                    <div v-else-if="qrStatus === 'ready'" class="qr-content">
                        <div class="qr-code">
                            <img :src="qrImage" alt="二维码" />
                        </div>
                        <p>使用酷狗音乐APP扫码登录</p>
                        <button class="refresh-btn" @click="refreshQr">刷新二维码</button>
                    </div>

                    <div v-else-if="qrStatus === 'scanned'" class="qr-scanned">
                        <div class="check-icon">✓</div>
                        <p>已扫码，请在手机上确认登录</p>
                    </div>

                    <div v-else-if="qrStatus === 'success'" class="qr-success">
                        <div class="success-icon">✓</div>
                        <p>登录成功，正在跳转...</p>
                    </div>

                    <div v-else-if="qrStatus === 'expired'" class="qr-expired">
                        <p>二维码已过期</p>
                        <button class="refresh-btn" @click="refreshQr">重新获取</button>
                    </div>
                </div>

                <div v-else-if="loginMethod === 'wx'" class="qr-login">
                    <div v-if="wxStatus === 'loading'" class="loading">
                        <div class="spinner"></div>
                        <p>正在获取微信二维码...</p>
                    </div>

                    <div v-else-if="wxStatus === 'ready'" class="qr-content">
                        <div class="qr-code">
                            <img :src="wxQrImage" alt="微信二维码" />
                        </div>
                        <p>使用微信扫码登录</p>
                        <button class="refresh-btn" @click="refreshWx">刷新二维码</button>
                    </div>

                    <div v-else-if="wxStatus === 'scanned'" class="qr-scanned">
                        <div class="check-icon">✓</div>
                        <p>已扫码，请在手机上确认登录</p>
                    </div>

                    <div v-else-if="wxStatus === 'success'" class="qr-success">
                        <div class="success-icon">✓</div>
                        <p>登录成功，正在跳转...</p>
                    </div>

                    <div v-else-if="wxStatus === 'expired'" class="qr-expired">
                        <p>二维码已过期</p>
                        <button class="refresh-btn" @click="refreshWx">重新获取</button>
                    </div>
                </div>

                <div v-else class="sms-login">
                    <div v-if="smsStatus === 'success'" class="qr-success">
                        <div class="success-icon">✓</div>
                        <p>登录成功，正在跳转...</p>
                    </div>
                    <div v-else>
                        <div class="form-group">
                            <label>手机号码</label>
                            <input
                                v-model="mobile"
                                type="tel"
                                placeholder="请输入手机号"
                                maxlength="11"
                            />
                        </div>

                        <div class="form-group">
                            <label>验证码</label>
                            <div class="code-input-group">
                                <input
                                    v-model="smsCode"
                                    type="text"
                                    placeholder="请输入验证码"
                                    maxlength="6"
                                />
                                <button
                                    :disabled="smsCountdown > 0 || isSendingCode"
                                    class="send-code-btn"
                                    @click="handleSendSms"
                                >
                                    {{ smsCountdown > 0 ? `${smsCountdown}s` : '发送验证码' }}
                                </button>
                            </div>
                        </div>

                        <button
                            class="login-btn"
                            @click="handleSmsLogin"
                            :disabled="smsStatus === 'loading'"
                        >
                            {{ smsStatus === 'loading' ? '登录中...' : '登录' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.login-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.login-modal {
    background: #fff;
    border-radius: 12px;
    width: 400px;
    padding: 24px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    color: #333;
}

.login-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
}

.login-modal-header h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #1a1a1a;
}

.close-btn {
    width: 28px;
    height: 28px;
    border: none;
    background: #f0f0f0;
    border-radius: 50%;
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #333;
}

.close-btn:hover {
    background: #e0e0e0;
}

.login-tabs {
    display: flex;
    gap: 16px;
    margin-bottom: 24px;
}

.tab-btn {
    flex: 1;
    padding: 12px;
    border: none;
    background: #f5f5f5;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
    color: #333;
}

.tab-btn.active {
    background: #1a73e8;
    color: #fff;
}

.error-message {
    color: #f44336;
    font-size: 14px;
    margin-bottom: 16px;
    text-align: center;
}

.qr-login {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px 0;
}

.loading {
    padding: 24px;
    text-align: center;
}

.loading p {
    color: #333;
    margin: 0;
}

.spinner {
    width: 36px;
    height: 36px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #1a73e8;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 12px;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}

.qr-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
}

.qr-code {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    background: #fafafa;
    border-radius: 8px;
}

.qr-code img {
    width: 180px;
    height: 180px;
    border-radius: 6px;
}

.qr-content p {
    margin: 0;
    color: #666;
    font-size: 13px;
}

.refresh-btn {
    margin-top: 4px;
    padding: 8px 20px;
    border: 1px solid #1a73e8;
    background: #fff;
    color: #1a73e8;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
}

.refresh-btn:hover {
    background: #f0f7ff;
}

.qr-scanned {
    padding: 24px;
    text-align: center;
}

.qr-scanned p {
    margin: 0;
    color: #333;
}

.check-icon {
    width: 50px;
    height: 50px;
    background: #4caf50;
    border-radius: 50%;
    color: #fff;
    font-size: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 12px;
}

.qr-success {
    padding: 24px;
    text-align: center;
}

.qr-success p {
    margin: 0;
    color: #333;
}

.success-icon {
    width: 50px;
    height: 50px;
    background: #4caf50;
    border-radius: 50%;
    color: #fff;
    font-size: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 12px;
    animation: successPulse 0.5s ease;
}

@keyframes successPulse {
    0% {
        transform: scale(0);
    }
    50% {
        transform: scale(1.1);
    }
    100% {
        transform: scale(1);
    }
}

.qr-expired {
    padding: 24px;
    text-align: center;
}

.qr-expired p {
    margin: 0;
    color: #333;
}

.sms-login {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.form-group label {
    font-size: 14px;
    font-weight: 500;
    color: #333;
}

.form-group input {
    padding: 12px;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    font-size: 14px;
    color: #333;
    background: #fff;
}

.code-input-group {
    display: flex;
    gap: 12px;
}

.code-input-group input {
    flex: 1;
}

.send-code-btn {
    padding: 12px 20px;
    border: 1px solid #1a73e8;
    background: #fff;
    color: #1a73e8;
    border-radius: 8px;
    cursor: pointer;
}

.send-code-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.login-btn {
    padding: 14px;
    border: none;
    background: #1a73e8;
    color: #fff;
    border-radius: 8px;
    font-size: 16px;
    cursor: pointer;
    margin: 8px auto 0;
    width: 80%;
    display: block;
    transition: transform 0.2s ease;
}

.login-btn:hover {
    background: #888888;
    transform: scale(1.05);
}

.login-btn:active {
    transform: scale(0.95);
}
</style>