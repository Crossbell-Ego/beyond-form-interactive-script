// ==========================================================================
// 拯救爆肝地獄！新人的部門改造計畫 - 遊戲邏輯與交互控制 (分頁切換多 Agent 版)
// ==========================================================================

// 靜態開場對話資料（依據 SDD 規格，作為遊戲分頁二的起點）
const dialogueData = [
    {
        role: "夏凌",
        image: "images/角色一.png",
        styleClass: "role-hr",
        text: "總經理，這個新人昨天的加班時數不達標。根據 HR 的不適任淘汰的規定，我建議今天就讓他捲鋪蓋走人，這對公司才是最有效率的選擇。"
    },
    {
        role: "蘇恬",
        image: "images/角色二.png",
        styleClass: "role-gm",
        text: "夏凌，你那套冰冷的 KPI 數據該適可而止了。如果一個部門只剩下瘋狂加班 and 內鬥，那公司離倒閉也不遠了。這位新人，我想聽聽你的想法，你打算怎麼解決你目前的處境？"
    }
];

// 遊戲狀態與對話歷史變數
let currentPageState = "start"; // start, story, game, chat, transition, ending
let dialogueIndex = 0;
let isTyping = false;
let typeInterval = null;
let currentTextToShow = "";

// 多 Agent 對話變數
let chatHistoryData = [];      // 儲存對話上下文 [{role: "夏凌", text: "..."}, ...]
let roundCount = 0;           // 目前對話輪數
let currentSpeakerState = "";  // 當前說話角色："hr", "gm", "player"
let currentDualReply = null;   // 保存當前 AI 生成的雙角色回覆數據

// DOM 元素選取
const pageStart = document.getElementById("page-start");
const pageStory = document.getElementById("page-story");
const pageGame = document.getElementById("page-game");
const pageChat = document.getElementById("page-chat");
const pageTransition = document.getElementById("page-transition");
const pageChapter2Start = document.getElementById("page-chapter2-start");
const pageChapter2Chat = document.getElementById("page-chapter2-chat");
const endingScreen = document.getElementById("ending-screen");

// 分頁二 (page-game) 立繪 (開場置中)
const charImg = document.getElementById("char-img");
const nameBox = document.getElementById("name-box");
const dialogueText = document.getElementById("dialogue-text");
const clickPrompt = document.getElementById("click-prompt");
const statusText = document.getElementById("status-text");

// 分頁六 (page-chapter2-start) 立繪與文字
const charImgC2 = document.getElementById("char-img-c2");
const c2DialogueText = document.getElementById("c2-dialogue-text");

// 分頁四 (page-chat) 立繪與聊天 UI
const chatWrapperHr = document.getElementById("chat-wrapper-hr");
const chatWrapperGm = document.getElementById("chat-wrapper-gm");
const chatHistory = document.getElementById("chat-history");
const chatStatusText = document.getElementById("chat-status-text");

// 分頁四的底部發言與輸入區
const chatInputContainer = document.getElementById("chat-input-container");
const chatPlayerResponse = document.getElementById("chat-player-response");
const chatSubmitResponseBtn = document.getElementById("chat-submit-response-btn");
const quickOptButtons = document.querySelectorAll(".quick-opt-btn");
const chatAiLoading = document.getElementById("chat-ai-loading");

// 分頁七 (page-chapter2-chat) 立繪與聊天 UI
const c2ChatHistory = document.getElementById("c2-chat-history");
const c2ChatStatusText = document.getElementById("c2-chat-status-text");
const c2ChatInputContainer = document.getElementById("c2-chat-input-container");
const c2ChatPlayerResponse = document.getElementById("c2-chat-player-response");
const c2ChatSubmitResponseBtn = document.getElementById("c2-chat-submit-response-btn");
const c2ChatAiLoading = document.getElementById("c2-chat-ai-loading");

// 結局畫面
const endingTitle = document.getElementById("ending-title");
const endingDescription = document.getElementById("ending-description");
const endingIllustration = document.getElementById("ending-illustration");
const restartBtn = document.getElementById("restart-btn");

// API 設定 Modal 元素
const apiSettingsBtn = document.getElementById("api-settings-btn");
const apiModal = document.getElementById("api-modal");
const closeBtn = document.querySelector(".close-btn");
const saveApiBtn = document.getElementById("save-api-btn");
const clearApiBtn = document.getElementById("clear-api-btn");
const apiKeyInput = document.getElementById("api-key");
const apiModelInput = document.getElementById("api-model");


// ==========================================================================
// 1. API Key 與 Model 管理 (支援 localStorage 與 .env 自動載入)
// ==========================================================================

let geminiApiKey = localStorage.getItem("gemini_api_key") || "";
let geminiModel = localStorage.getItem("gemini_model") || "gemini-3.1-flash-lite";

// 設定預設輸入框值
apiKeyInput.value = geminiApiKey;
apiModelInput.value = geminiModel;

if (geminiApiKey) {
    apiSettingsBtn.textContent = `⚙️ AI 已啟用 (${geminiModel})`;
    apiSettingsBtn.style.color = "var(--color-gm)";
}

// 簡單解析 .env 格式
function parseEnv(text) {
    const config = {};
    const lines = text.split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const index = trimmed.indexOf("=");
        if (index > 0) {
            const key = trimmed.substring(0, index).trim();
            let val = trimmed.substring(index + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            config[key] = val;
        }
    }
    return config;
}

// 非同步讀取本地 .env 設定
async function loadEnvConfig() {
    try {
        const response = await fetch(".env");
        if (response.ok) {
            const text = await response.text();
            const config = parseEnv(text);
            
            let hasEnv = false;
            if (config.GEMINI_API_KEY && config.GEMINI_API_KEY.trim()) {
                geminiApiKey = config.GEMINI_API_KEY.trim();
                apiKeyInput.value = geminiApiKey;
                hasEnv = true;
            }
            if (config.GEMINI_MODEL && config.GEMINI_MODEL.trim()) {
                geminiModel = config.GEMINI_MODEL.trim();
                apiModelInput.value = geminiModel;
            }
            
            if (hasEnv) {
                const envStatusBadge = document.getElementById("env-status-badge");
                if (envStatusBadge) {
                    envStatusBadge.classList.remove("hidden");
                }
                apiSettingsBtn.textContent = `⚙️ AI 已啟用 (.env:${geminiModel})`;
                apiSettingsBtn.style.color = "var(--color-gm)";
            }
        }
    } catch (e) {
        console.log("本地 .env 載入受 CORS 或協議限制，將改用 localStorage 設定。", e);
    }
}

// 執行載入
loadEnvConfig();

// 開啟彈窗
apiSettingsBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // 阻止氣泡事件
    apiModal.classList.add("active");
});

// 關閉彈窗
closeBtn.addEventListener("click", () => {
    apiModal.classList.remove("active");
});

window.addEventListener("click", (e) => {
    if (e.target === apiModal) {
        apiModal.classList.remove("active");
    }
});

// 儲存設定 (API Key & Model)
saveApiBtn.addEventListener("click", () => {
    const key = apiKeyInput.value.trim();
    const model = apiModelInput.value.trim() || "gemini-3.1-flash-lite";
    
    if (key) {
        localStorage.setItem("gemini_api_key", key);
        localStorage.setItem("gemini_model", model);
        geminiApiKey = key;
        geminiModel = model;
        apiSettingsBtn.textContent = `⚙️ AI 已啟用 (${model})`;
        apiSettingsBtn.style.color = "var(--color-gm)";
        
        const envStatusBadge = document.getElementById("env-status-badge");
        if (envStatusBadge) {
            envStatusBadge.classList.add("hidden");
        }
        
        alert("AI 設定儲存成功！");
    } else {
        alert("請輸入有效的 API Key。");
    }
    apiModal.classList.remove("active");
});

// 清除設定
clearApiBtn.addEventListener("click", () => {
    localStorage.removeItem("gemini_api_key");
    localStorage.removeItem("gemini_model");
    geminiApiKey = "";
    geminiModel = "gemini-3.1-flash-lite";
    apiKeyInput.value = "";
    apiModelInput.value = "gemini-3.1-flash-lite";
    
    const envStatusBadge = document.getElementById("env-status-badge");
    if (envStatusBadge) {
        envStatusBadge.classList.add("hidden");
    }
    
    apiSettingsBtn.textContent = "⚙️ AI 設定";
    apiSettingsBtn.style.color = "var(--text-muted)";
    alert("AI 設定已清除，遊戲將改用本地智慧模擬。");
    apiModal.classList.remove("active");
});


// ==========================================================================
// 2. 角色立繪高亮亮暗與歷史紀錄控制
// ==========================================================================

// 設定正在發言的角色高亮，另一位暗淡。僅在分頁四進行左右對峙控制
function setActiveSpeaker(role) {
    if (currentPageState === "chat") {
        if (role === "夏凌") {
            chatWrapperHr.classList.add("active-speaker");
            chatWrapperGm.classList.remove("active-speaker");
        } else if (role === "蘇恬") {
            chatWrapperGm.classList.add("active-speaker");
            chatWrapperHr.classList.remove("active-speaker");
        } else {
            chatWrapperHr.classList.remove("active-speaker");
            chatWrapperGm.classList.remove("active-speaker");
        }
    }
}

// AI 對答串接狀態機變數
let aiFlowStep = 5; // 5 代表閒置/玩家回合
let currentActiveBubble = null;
let currentActiveBubbleRole = "";
let currentActiveBubbleText = "";
let aiTimeoutId = null;

// 動態生成打字中氣泡
function appendTypingBubble(role) {
    const bubble = document.createElement("div");
    bubble.classList.add("chat-bubble", "typing-bubble");
    
    if (role === "夏凌") {
        bubble.classList.add("hr-bubble");
        bubble.innerHTML = `<strong>夏凌</strong><br><span class="typing-indicator"><span>.</span><span>.</span><span>.</span></span>`;
    } else if (role === "蘇恬") {
        bubble.classList.add("gm-bubble");
        bubble.innerHTML = `<strong>蘇恬</strong><br><span class="typing-indicator"><span>.</span><span>.</span><span>.</span></span>`;
    } else if (role === "余鋒烈") {
        bubble.classList.add("leader-bubble");
        bubble.innerHTML = `<strong>余鋒烈</strong><br><span class="typing-indicator"><span>.</span><span>.</span><span>.</span></span>`;
    }
    
    const targetHistory = currentPageState === "chapter2_chat" ? c2ChatHistory : chatHistory;
    targetHistory.appendChild(bubble);
    targetHistory.scrollTop = targetHistory.scrollHeight;
    return bubble;
}

// 在氣泡中執行打字機特效
function typewriteBubble(bubble, role, text, onComplete) {
    clearInterval(typeInterval);
    isTyping = true;
    currentTextToShow = text;
    
    bubble.classList.remove("typing-bubble");
    bubble.innerHTML = `<strong>${role}</strong><br>`;
    
    const textSpan = document.createElement("span");
    bubble.appendChild(textSpan);
    
    const targetHistory = currentPageState === "chapter2_chat" ? c2ChatHistory : chatHistory;
    
    let index = 0;
    typeInterval = setInterval(() => {
        if (index < text.length) {
            textSpan.textContent += text[index];
            index++;
            targetHistory.scrollTop = targetHistory.scrollHeight;
        } else {
            isTyping = false;
            clearInterval(typeInterval);
            if (onComplete) onComplete();
        }
    }, 30);
}

// 加速/跳過氣泡打字
function skipBubbleTypewriter() {
    clearInterval(typeInterval);
    isTyping = false;
    if (currentActiveBubble) {
        currentActiveBubble.classList.remove("typing-bubble");
        currentActiveBubble.innerHTML = `<strong>${currentActiveBubbleRole}</strong><br><span>${currentActiveBubbleText}</span>`;
        const targetHistory = currentPageState === "chapter2_chat" ? c2ChatHistory : chatHistory;
        targetHistory.scrollTop = targetHistory.scrollHeight;
    }
    
    if (currentPageState === "chapter2_chat") {
        chatHistoryData.push({ role: "余鋒烈", text: currentActiveBubbleText });
        return;
    }
    
    // 進入下一步
    if (aiFlowStep === 1) {
        chatHistoryData.push({ role: "夏凌", text: currentActiveBubbleText });
        aiFlowStep = 2;
        runAiFlowStep();
    } else if (aiFlowStep === 3) {
        chatHistoryData.push({ role: "蘇恬", text: currentActiveBubbleText });
        aiFlowStep = 4;
        runAiFlowStep();
    }
}

// 跳過 AI 對答中間的等待/延遲
function skipAiDelay() {
    clearTimeout(aiTimeoutId);
    runAiFlowStep();
}

// 啟動 AI 連鎖對話流
function startAiResponseFlow() {
    aiFlowStep = 0;
    runAiFlowStep();
}

// AI 對答狀態機核心邏輯
function runAiFlowStep() {
    clearTimeout(aiTimeoutId);
    
    if (aiFlowStep === 0) {
        // 顯示夏凌輸入中
        chatStatusText.textContent = `第 ${roundCount} 輪：夏凌審查中...`;
        setActiveSpeaker("夏凌");
        currentActiveBubble = appendTypingBubble("夏凌");
        aiFlowStep = 1;
        aiTimeoutId = setTimeout(runAiFlowStep, 800);
    } 
    else if (aiFlowStep === 1) {
        // 夏凌開始打字
        currentActiveBubbleRole = "夏凌";
        currentActiveBubbleText = currentDualReply.char1_reply;
        typewriteBubble(currentActiveBubble, "夏凌", currentActiveBubbleText, () => {
            chatHistoryData.push({ role: "夏凌", text: currentActiveBubbleText });
            aiFlowStep = 2;
            aiTimeoutId = setTimeout(runAiFlowStep, 1000);
        });
    } 
    else if (aiFlowStep === 2) {
        // 顯示蘇恬輸入中
        chatStatusText.textContent = `第 ${roundCount} 輪：蘇恬思索中...`;
        setActiveSpeaker("蘇恬");
        currentActiveBubble = appendTypingBubble("蘇恬");
        aiFlowStep = 3;
        aiTimeoutId = setTimeout(runAiFlowStep, 800);
    } 
    else if (aiFlowStep === 3) {
        // 蘇恬開始打字
        currentActiveBubbleRole = "蘇恬";
        currentActiveBubbleText = currentDualReply.char2_reply;
        typewriteBubble(currentActiveBubble, "蘇恬", currentActiveBubbleText, () => {
            chatHistoryData.push({ role: "蘇恬", text: currentActiveBubbleText });
            aiFlowStep = 4;
            aiTimeoutId = setTimeout(runAiFlowStep, 800);
        });
    } 
    else if (aiFlowStep === 4) {
        // AI 回應完畢，決定是否進入第一章結束過渡頁或重啟玩家輸入
        setActiveSpeaker("none");
        if (currentDualReply.trigger_transition) {
            chatStatusText.textContent = "點擊任意處繼續 ➔";
            aiFlowStep = 6;
        } else if (currentDualReply.trigger_ending) {
            showEndingCard(currentDualReply.ending_data);
            aiFlowStep = 5;
        } else {
            showInputArea();
            aiFlowStep = 5;
        }
    }
}

// 動態生成氣泡並加入滾動歷史紀錄區 (分頁四/分頁七)
function appendChatBubble(role, text) {
    const bubble = document.createElement("div");
    bubble.classList.add("chat-bubble");
    
    if (role === "夏凌") {
        bubble.classList.add("hr-bubble");
        bubble.innerHTML = `<strong>夏凌</strong><br><span>${text}</span>`;
    } else if (role === "蘇恬") {
        bubble.classList.add("gm-bubble");
        bubble.innerHTML = `<strong>蘇恬</strong><br><span>${text}</span>`;
    } else if (role === "余鋒烈") {
        bubble.classList.add("leader-bubble");
        bubble.innerHTML = `<strong>余鋒烈</strong><br><span>${text}</span>`;
    } else {
        bubble.classList.add("player-bubble");
        bubble.innerHTML = `<span>${text}</span>`;
    }
    
    const targetHistory = currentPageState === "chapter2_chat" ? c2ChatHistory : chatHistory;
    targetHistory.appendChild(bubble);
    targetHistory.scrollTop = targetHistory.scrollHeight;
}


// ==========================================================================
// 3. 遊戲流程狀態機與點擊推進
// ==========================================================================

// 監聽全域點擊事件，用於推進對話
document.body.addEventListener("click", (e) => {
    // 排除與按鈕、輸入框、彈窗的互動
    if (e.target.closest("button") || 
        e.target.closest("textarea") || 
        e.target.closest("input") || 
        e.target.closest(".modal-content") || 
        e.target.closest(".ending-card") ||
        e.target.closest("#chat-input-container") ||
        e.target.closest("#c2-chat-input-container")) {
        return;
    }

    handleGlobalClick();
});

function handleGlobalClick() {
    if (currentPageState === "start") {
        showStoryPage();
    } else if (currentPageState === "story") {
        startGame();
    } else if (currentPageState === "game") {
        // 分頁二開場白對話
        if (isTyping) {
            skipTypewriter();
            return;
        }
        
        if (dialogueIndex === 1) {
            // 夏凌開場白播完，點擊推進蘇恬開場白
            advanceDialogue();
        } else if (dialogueIndex === 2) {
            // 蘇恬開場白播完，點擊切換進入分頁四 (對話循環頁)
            switchToChatPage();
        } 
    } else if (currentPageState === "chat") {
        // 分頁四 LINE/Telegram 對話流
        if (aiFlowStep !== 5) {
            if (isTyping) {
                skipBubbleTypewriter();
            } else if (aiFlowStep === 6) {
                aiFlowStep = 5;
                switchToTransitionPage();
            } else {
                skipAiDelay();
            }
        }
    } else if (currentPageState === "transition") {
        switchToChapter2();
    } else if (currentPageState === "chapter2_start") {
        if (isTyping) {
            skipTypewriter();
            return;
        }
        switchToChapter2Chat();
    } else if (currentPageState === "chapter2_chat") {
        if (aiFlowStep !== 5) {
            if (isTyping) {
                skipBubbleTypewriter();
            } else {
                skipAiDelay();
            }
        }
    }
}

// 顯示故事背景頁 (分頁三)
function showStoryPage() {
    currentPageState = "story";
    pageStart.classList.remove("active");
    pageStory.classList.add("active");
}

// 進入開場對話頁 (分頁二)
function startGame() {
    currentPageState = "game";
    pageStory.classList.remove("active");
    pageGame.classList.add("active");
    
    // 初始化多輪對話變數與歷史紀錄
    chatHistoryData = [];
    chatHistory.innerHTML = "";
    roundCount = 0;
    currentSpeakerState = "";
    currentDualReply = null;
    
    dialogueIndex = 0;
    clickPrompt.classList.remove("hidden");
    
    // 清空兩頁的立繪亮暗與重置開場立繪
    charImg.src = "";
    charImg.classList.remove("show");
    chatWrapperHr.classList.remove("active-speaker");
    chatWrapperGm.classList.remove("active-speaker");
    
    advanceDialogue();
}

// 推進分頁二開場對話
function advanceDialogue() {
    if (dialogueIndex < dialogueData.length) {
        const currentData = dialogueData[dialogueIndex];
        
        statusText.textContent = currentData.role === "夏凌" ? "夏凌的淘汰警告" : "蘇恬的引導詢問";
        nameBox.textContent = currentData.role;
        nameBox.className = "name-box " + currentData.styleClass;
        
        // 切換置中單立繪圖片源並加載 show 動畫
        charImg.classList.remove("show");
        setTimeout(() => {
            charImg.src = currentData.image;
            charImg.classList.add("show");
        }, 150);

        startTypewriter(currentData.text);
        
        dialogueIndex++;
    }
}

// 切換至對話循環頁面 (分頁四)
function switchToChatPage() {
    currentPageState = "chat";
    pageGame.classList.remove("active");
    pageChat.classList.add("active");
    
    // 將第一句開場白（夏凌）寫入聊天氣泡
    appendChatBubble("夏凌", dialogueData[0].text);
    chatHistoryData.push({ role: "夏凌", text: dialogueData[0].text });
    
    // 延遲一下再放入第二句開場白（蘇恬），模擬 LINE 通訊軟體陸續收到訊息的真實感
    aiTimeoutId = setTimeout(() => {
        appendChatBubble("蘇恬", dialogueData[1].text);
        chatHistoryData.push({ role: "蘇恬", text: dialogueData[1].text });
        showInputArea();
    }, 800);
}

// 切換至第一章過渡頁 (分頁五)
function switchToTransitionPage() {
    currentPageState = "transition";
    pageChat.classList.remove("active");
    pageTransition.classList.add("active");
    
    // 重置並重新執行段落依序浮現的動畫效果
    const paragraphs = pageTransition.querySelectorAll(".transition-body p, .transition-click-prompt");
    paragraphs.forEach(p => {
        p.style.animation = "none";
        p.offsetHeight; // 觸發 reflow
        p.style.animation = null;
    });
}

// 切換至第二章開場對話頁 (分頁六)
function switchToChapter2() {
    currentPageState = "chapter2_start";
    pageTransition.classList.remove("active");
    pageChapter2Start.classList.add("active");
    
    // 初始化立繪與打字機特效
    charImgC2.classList.remove("show");
    c2DialogueText.textContent = "";
    
    setTimeout(() => {
        charImgC2.classList.add("show");
        const chapter2IntroText = "嘿！你就是總經理親點調來的新人吧？聽說你在業務部搞了個大動作，有衝勁！  實話告訴你，我們接下來要推動『跨國智慧管理系統』，只要成功，就能徹底掀翻公司爆肝加班的爛制度！  但現在夏凌正盯著我們的預算，我們第一步必須在不被他抓到把柄的情況下，拿到海外分公司的測試數據。挑戰來了，你有膽量跟我一起幹這條大的嗎？你打算用什麼策略幫專案跨出這第一步？說聽聽你的計畫！";
        startTypewriter(chapter2IntroText);
    }, 150);
}

// 顯示分頁四的玩家輸入區
function showInputArea() {
    currentSpeakerState = "player";
    setActiveSpeaker("none");
    
    chatInputContainer.classList.remove("hidden");
    chatStatusText.textContent = "請輸入你的回應對策";
    
    chatPlayerResponse.value = "";
    chatPlayerResponse.focus();
}


// ==========================================================================
// 4. 打字機特效 (Typewriter Effect)
// ==========================================================================

function startTypewriter(text) {
    clearInterval(typeInterval);
    isTyping = true;
    currentTextToShow = text;
    
    if (currentPageState === "game") {
        dialogueText.textContent = "";
    } else if (currentPageState === "chapter2_start") {
        c2DialogueText.textContent = "";
    }
    
    let index = 0;
    typeInterval = setInterval(() => {
        if (index < text.length) {
            if (currentPageState === "game") {
                dialogueText.textContent += text[index];
            } else if (currentPageState === "chapter2_start") {
                c2DialogueText.textContent += text[index];
            }
            index++;
        } else {
            clearInterval(typeInterval);
            isTyping = false;
        }
    }, 50);
}

function skipTypewriter() {
    clearInterval(typeInterval);
    isTyping = false;
    if (currentPageState === "game") {
        dialogueText.textContent = currentTextToShow;
    } else if (currentPageState === "chapter2_start") {
        c2DialogueText.textContent = currentTextToShow;
    }
}

// ==========================================================================
// 5. 聊天氣泡與玩家互動
// ==========================================================================

// 監聽輸入框 Enter 鍵
chatPlayerResponse.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        chatSubmitResponseBtn.click();
    }
});

// 監聽發送按鈕點擊
chatSubmitResponseBtn.addEventListener("click", () => {
    const text = chatPlayerResponse.value.trim();
    if (text) {
        submitPlayerDecision(text);
        chatPlayerResponse.value = "";
    }
});

// 處理玩家提交
function submitPlayerDecision(inputText) {
    // 隱藏輸入框，顯示 AI 載入動畫
    chatInputContainer.classList.add("hidden");
    chatAiLoading.classList.remove("hidden");
    chatStatusText.textContent = "AI Agent 正在分析策略對答中...";
    
    // 加入玩家說的話到歷史紀錄氣泡
    appendChatBubble("你", inputText);
    chatHistoryData.push({ role: "你", text: inputText });
    
    roundCount++;

    // 呼叫 API 或智慧模擬
    setTimeout(async () => {
        if (geminiApiKey) {
            currentDualReply = await fetchDualAgentResponse(inputText);
        } else {
            currentDualReply = getLocalSimulatedDualResponse(inputText);
        }

        // 結束載入，隱藏動畫
        chatAiLoading.classList.add("hidden");
        
        // 啟動對答狀態機
        startAiResponseFlow();
    }, 1200);
}

// 切換至第二章對答頁 (分頁七)
function switchToChapter2Chat() {
    currentPageState = "chapter2_chat";
    pageChapter2Start.classList.remove("active");
    pageChapter2Chat.classList.add("active");
    
    // 初始化對話歷史
    c2ChatHistory.innerHTML = "";
    chatHistoryData = []; 
    roundCount = 1;
    
    const introText = "嘿！你就是總經理親點調來的新人吧？聽說你在業務部搞了個大動作，有衝勁！  實話告訴你，我們接下來要推動『跨國智慧管理系統』，只要成功，就能徹底掀翻公司爆肝加班的爛制度！  但現在夏凌正盯著我們的預算，我們第一步必須在不被他抓到把柄的情況下，拿到海外分公司的測試數據。挑戰來了，你有膽量跟我一起幹這條大的嗎？你打算用什麼策略幫專案跨出這第一步？說聽聽你的計畫！";
    appendChatBubble("余鋒烈", introText);
    chatHistoryData.push({ role: "余鋒烈", text: introText });
    
    showC2InputArea();
}

// 顯示分頁七的玩家輸入區
function showC2InputArea() {
    currentSpeakerState = "player";
    c2ChatInputContainer.classList.remove("hidden");
    c2ChatStatusText.textContent = "請輸入你的回應對策";
    c2ChatPlayerResponse.value = "";
    c2ChatPlayerResponse.focus();
}

// 監聽分頁七輸入框 Enter 鍵
c2ChatPlayerResponse.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        c2ChatSubmitResponseBtn.click();
    }
});

// 監聽分頁七發送按鈕點擊
c2ChatSubmitResponseBtn.addEventListener("click", () => {
    const text = c2ChatPlayerResponse.value.trim();
    if (text) {
        submitC2PlayerDecision(text);
        c2ChatPlayerResponse.value = "";
    }
});

// 處理第二章玩家提交
function submitC2PlayerDecision(inputText) {
    c2ChatInputContainer.classList.add("hidden");
    c2ChatAiLoading.classList.remove("hidden");
    c2ChatStatusText.textContent = "余鋒烈正在思考你的職場策略...";
    
    appendChatBubble("你", inputText); // 使用玩家發言
    chatHistoryData.push({ role: "你", text: inputText });
    
    roundCount++;
    
    setTimeout(async () => {
        let responseObj;
        if (geminiApiKey) {
            responseObj = await fetchLeaderResponse(inputText);
        } else {
            responseObj = getLocalSimulatedLeaderResponse(inputText);
        }
        
        c2ChatAiLoading.classList.add("hidden");
        
        c2ChatStatusText.textContent = `第 ${roundCount} 輪：余鋒烈思考中...`;
        const bubble = appendTypingBubble("余鋒烈");
        
        setTimeout(() => {
            currentActiveBubble = bubble;
            currentActiveBubbleRole = "余鋒烈";
            currentActiveBubbleText = responseObj.reply;
            
            typewriteBubble(bubble, "余鋒烈", responseObj.reply, () => {
                chatHistoryData.push({ role: "余鋒烈", text: responseObj.reply });
                
                if (responseObj.trigger_ending) {
                    showEndingCard(responseObj.ending_data);
                } else if (responseObj.trigger_transition) {
                    alert("你提出的方案深得余鋒烈認可！專案跨出關鍵一步！第二章【吞日黑幕】演示結束，感謝遊玩！");
                    restartBtn.click();
                } else {
                    showC2InputArea();
                }
            });
        }, 800);
    }, 1200);
}

// 呼叫第二章主管 Gemini API
async function fetchLeaderResponse(inputText) {
    const historyText = chatHistoryData.map(item => `${item.role}: ${item.text}`).join("\n");
    
    const prompt = `
你現在是線上職場劇本殺《化形之後》的第二章對答 Agent 系統。請扮演角色：
「余鋒烈」（業務部北區副理。熱血樂觀、說話直接、不服輸、理想主義導向。討厭保守與紙上談兵，極度欣賞敢冒險、有突破性構想的新人）。

目前為止，第二章的對話歷史紀錄如下：
${historyText}

現在，玩家（新人）說了這番話：
「${inputText}」

請根據余鋒烈的背景性格，生成他對玩家的回應文字。
【核心核心推進判定規則】：
1. 仔細評估玩家說的話，玩家是否提出了一個「具有突破性、有膽量或創意的具體執行策略」（例如：利用自動化腳本爬取數據、暗中突破限制、設計繞過夏凌的秘密方法等）。
2. 如果玩家的方案「太過保守、直接放棄、或者只是敷衍的空話」，請讓余鋒烈繼續進行熱血引導或駁斥，並將 JSON 中的 "trigger_transition" 設為 false。
3. 如果玩家「確實提出了有創意且大膽的策略」，代表玩家得到了余鋒烈的認可！此時余鋒烈的回應文字（reply）必須表達極高的讚賞與熱血合作態度，且務必將 JSON 中的 "trigger_transition" 設為 true。

請務必只返回一個 JSON 對象，不要包含 Markdown 格式的 \`\`\`json 標記。格式必須嚴格符合以下結構：
{
  "reply": "余鋒烈對玩家回應的文字...",
  "trigger_transition": 填入 true 或 false,
  "trigger_ending": false
}
`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: prompt }
                        ]
                    }
                ],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            })
        });

        if (!response.ok) {
            throw new Error("API request failed");
        }

        const data = await response.json();
        const responseText = data.candidates[0].content.parts[0].text;
        return JSON.parse(responseText.trim());
    } catch (error) {
        console.error("呼叫 Gemini API 發生錯誤，轉為本地智慧模擬:", error);
        const fallback = getLocalSimulatedLeaderResponse(inputText);
        fallback.reply = "⚠️ [API連線異常，已切換至本地模擬] " + fallback.reply;
        return fallback;
    }
}

// 本地智慧模擬降級方案 (第二章 余鋒烈單獨版)
function getLocalSimulatedLeaderResponse(text) {
    const textLower = text.toLowerCase();
    const isCreative = /(自動|爬蟲|暗中|繞過|調查|科技|數據|海外|偷爬|腳本|程式|api|直接|秘密)/.test(textLower);
    
    let reply = "這樣可能不太行吧？我想看到更具突破性、更帶有膽識的計畫！如果只是做些保守的紙上談兵，夏凌那邊隨便一查我們就完蛋了。有沒有更狂野一點的點子？";
    let trigger_transition = false;
    
    if (isCreative) {
        reply = "好！有膽量！用這個方法確實可以在夏凌毫無察覺的情況下把數據弄到手！業務部就需要你這種敢於突破常規的悍將。那我們今天晚上就動手，你來寫抓取工具，我負責在前方打掩護，把這條大的幹下來！";
        trigger_transition = true;
    } else if (/(放棄|不可能|沒辦法|投降|太難|保守|照規矩|害怕|檢舉)/.test(textLower)) {
        reply = "什麼？還沒開始就說不可能？我們要是遇到困難就退縮，那跟外面那些只會唯唯諾諾的爆肝行屍走肉有什麼兩樣？拿出新人的氣勢來，再想想，一定有破局的方法！";
    }
    
    return {
        reply: reply,
        trigger_transition: trigger_transition,
        trigger_ending: false
    };
}


// ==========================================================================
// 6. Gemini API 多 Agent 聯動 Prompt 呼叫
// ==========================================================================

async function fetchDualAgentResponse(inputText) {
    const historyText = chatHistoryData.map(item => `${item.role}: ${item.text}`).join("\n");
    
    const prompt = `
你現在是線上職場劇本殺《化形之後》的核心對答 Agent 系統。請同時扮演兩位角色：
1. 「夏凌」（KPI稽核主管。講求數據與極致效率，認為加班是提升產值的唯一手段，冷酷且說話刻薄[cite: 1]）。
2. 「蘇恬」（空降總經理。優雅有威嚴，想打破病態的爆肝加班文化，欣賞敢於改革的新人[cite: 1]）。

目前為止，辦公室裡的三方對話歷史紀錄如下：
${historyText}

現在，玩家（新人）面臨兩位高管的審核，說了這番話：
「${inputText}」

請根據兩位角色的背景性格與以上對話歷程，生成他們兩人的下一輪對答交鋒內容：
- 夏凌（角色一）會先對玩家的回覆進行挑剔、施壓或嘲諷，指責其拉低績效或缺乏奉獻度[cite: 1]。

【核心核心推進判定規則】：
1. 仔細評估玩家說的話，玩家是否真的提出了一個「具體的、具建設性的職場改善建議或改造計畫」（例如：引進自動化工具、優化流程、合理分配工時、拒絕無效加班等）[cite: 1, 2]。
2. 如果玩家「只是在抱怨、摸魚擺爛、或講空話」，請讓蘇恬繼續進行正常的引導詢問[cite: 1, 2]，並將 JSON 中的 "trigger_transition" 設為 false[cite: 2]。
3. 如果玩家「確實提出了合理的改善建議」，代表玩家得到了蘇恬的認可[cite: 2]！此時蘇恬（角色二）的回應文字（char2_reply）必須「逐字一字不差」地強制輸出以下這段指定台詞：
「很好，既然你提出了這個部門改造計畫，我就給你應有的權限。從明天起，你正式調任至萬鈞股份的『核心營運專案組』。讓我看看你能把這個爆肝地獄改變到什麼程度。」
並且，此時請務必將 JSON 中的 "trigger_transition" 設為 true[cite: 2]。

請務必只返回一個 JSON 對象，不要包含 Markdown 格式的 \`\`\`json 標記。格式必須嚴格符合以下結構：
{
  "char1_reply": "夏凌對玩家與當前局勢的刁難回應文字...",
  "char2_reply": "蘇恬駁斥夏凌並對玩家進行引導或認可的回應文字...",
  "trigger_transition": 填入 true 或 false
}
`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: prompt }
                        ]
                    }
                ],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            })
        });

        if (!response.ok) {
            throw new Error("API request failed");
        }

        const data = await response.json();
        const responseText = data.candidates[0].content.parts[0].text;
        
        return JSON.parse(responseText.trim());
    } catch (error) {
        console.error("呼叫 Gemini API 發生錯誤，轉為本地智慧模擬:", error);
        const fallback = getLocalSimulatedDualResponse(inputText);
        fallback.char1_reply = "⚠️ [API連線異常，已切換至本地模擬] " + fallback.char1_reply;
        return fallback;
    }
}

// 本地智慧模擬降級方案
function getLocalSimulatedDualResponse(text) {
    const textLower = text.toLowerCase();
    
    // 判定玩家是否提出了改善、自動化、工具、流程優化等關鍵建議[cite: 2]
    const hasImprovementPlan = /(ai|自動|工具|效率|優化|程式|流程|python|試算表|寫扣|科技|加速|合理|分配|計畫|建議|改造)/.test(textLower);
    
    let char1 = "你說得這麼冠冕堂皇，但你的工時數據依然是全組最低。HR 需要的是即戰力與實際的產出，而不是沒有著陸點的空泛口號！";
    let char2 = "新人，夏凌的數據要求雖然嚴厲，但確實是客觀事實。我想看到你更具強而有力的執行策略，否則我也難在董事會前為你說情。你有沒有具體的人體改革行動方案？";
    
    if (hasImprovementPlan) {
        char1 = "引進新工具和優化流程？這聽起來只是一頁 PPT 的噱頭。你能向 HR 稽核組保證這能帶來多少 ROI 增長？如果導入後績效反而下跌，這項責任誰來擔起？";
        // 得到認可，強制使用指定台詞[cite: 2]
        char2 = "很好，既然你提出了這個部門改造計畫，我就給你應有的權限。從明天起，你正式調任至萬鈞股份的『核心營運專案組』。讓我看看你能把這個爆肝地獄改變到什麼程度。";
    } else if (/(檢舉|勞基|申訴|打卡|工會|證據|截圖|法律|告他|檢舉信|投訴)/.test(textLower)) {
        char1 = "收集證據？檢舉？你這是公然威脅公司！一個不願意與部門共進退、整天只想著法律漏洞的人，根本毫無團隊凝聚力可言！";
        char2 = "夏凌，公司的合規營運才是第一要務。新人，如果部門確實有造假工時、未發加班費的實情，總經理室絕不姑息，你整理的資料可以直接呈報給我。";
    } else if (/(摸魚|下班|走人|打混|擺擺|隨便|睡覺|泡茶|下班了)/.test(textLower)) {
        char1 = "準時下班？摸魚？你這是在浪費公司的資源！實習期的評核指標是『無私奉獻度』，你這樣的擺爛態度，我現在就能當場把你開除！";
        char2 = "夏凌，新人如果能高效率地在上班時間完成工作，準時下班何罪之有？不過新人，如果你真的整天只想著混日子，希望你展現真正的實力。";
    }
    
    return {
        char1_reply: char1,
        char2_reply: char2,
        trigger_transition: hasImprovementPlan // 只要有改善計畫就觸發轉場[cite: 2]
    };
}

// ==========================================================================
// 7. 結局展示與重置
// ==========================================================================

function showEndingCard(endingData) {
    currentPageState = "ending";
    
    endingTitle.textContent = endingData.ending;
    endingDescription.textContent = endingData.description;
    endingIllustration.innerHTML = `<span style="font-size: 5rem;">${endingData.illustration || '🏆'}</span>`;
    
    const card = document.querySelector(".ending-card");
    if (endingData.ending.includes("改革") || endingData.ending.includes("智慧")) {
        card.style.boxShadow = "0 0 30px rgba(0, 240, 255, 0.4)";
    } else if (endingData.ending.includes("勞基") || endingData.ending.includes("捍衛")) {
        card.style.boxShadow = "0 0 30px rgba(139, 92, 246, 0.4)";
    } else if (endingData.ending.includes("摸魚") || endingData.ending.includes("快樂")) {
        card.style.boxShadow = "0 0 30px rgba(245, 158, 11, 0.4)";
    } else {
        card.style.boxShadow = "0 0 30px rgba(255, 59, 108, 0.4)";
    }

    endingScreen.classList.remove("hidden");
    endingScreen.classList.add("show");
}

// 重新開始遊戲
restartBtn.addEventListener("click", () => {
    endingScreen.classList.remove("show");
    setTimeout(() => {
        endingScreen.classList.add("hidden");
    }, 500);
    
    // 清除可能正在進行的 AI 流定時器
    clearTimeout(aiTimeoutId);
    clearInterval(typeInterval);
    aiFlowStep = 5;
    
    // 返回開始畫面
    currentPageState = "start";
    pageGame.classList.remove("active");
    pageStory.classList.remove("active");
    pageChat.classList.remove("active");
    pageTransition.classList.remove("active");
    pageChapter2Start.classList.remove("active");
    pageChapter2Chat.classList.remove("active");
    pageStart.classList.add("active");
});
