# 拯救爆肝地獄！新人的部門改造計畫 ─ 遊戲啟動指南

本遊戲為純前端靜態網頁專案。由於程式中包含透過 `fetch` 讀取 `.env` 設定檔（API Key 與 Model 設定）的邏輯，瀏覽器的安全隱私限制（CORS）會阻擋 `file://` 協議讀取本地檔案。因此**建議使用本地伺服器（Local Server）**開啟遊戲。

---

## 啟動方式

請選擇以下任一方式啟動遊戲：

### 方法一：使用 VS Code Live Server 擴充套件（最推薦）
1. 使用 **VS Code** 開啟此專案資料夾。
2. 安裝 [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) 擴充套件。
3. 在 VS Code 右下角點擊 **Go Live**，或在 `index.html` 按右鍵選擇 **Open with Live Server**。
4. 瀏覽器將自動開啟 `http://127.0.0.1:5500/index.html`。

---

### 方法二：使用 Python 快速啟動本地伺服器
如果電腦已安裝 Python，在專案根目錄下開啟終端機（Terminal / PowerShell），執行以下指令：

```bash
# Python 3
python -m http.server 8000
```
開啟瀏覽器並造訪：[http://localhost:8000](http://localhost:8000)

---

### 方法三：使用 Node.js / npm 啟動伺服器
如果你有 Node.js 環境，可以在專案根目錄下執行：

```bash
npx serve .
# 或者
npx http-server .
```
接著根據終端機輸出的網址（通常為 `http://localhost:3000` 或 `http://localhost:8080`）造訪即可。

---

### 方法四：直接雙擊 `index.html`（降級模式）
* 雙擊直接開啟 `index.html`。
* **注意**：在此模式下，系統將無法讀取 `.env` 檔案。如果需要使用 Gemini AI 功能，請進入遊戲後點擊畫面上的 **⚙️ AI 設定** 按鈕，手動貼入你的 Gemini API Key。若不輸入，遊戲將自動切換為「本地智慧模擬（Local Simulation）」降級方案運行。

---

## AI 功能設定

若要啟用 Gemini 智慧對答：
1. 在專案根目錄下建立 `.env` 檔案，格式如下：
   ```env
   GEMINI_API_KEY=你的_GEMINI_API_KEY
   GEMINI_MODEL=gemini-2.5-flash
   ```
2. 啟動伺服器後，遊戲會自動讀取並顯示 `⚙️ AI 已啟用 (.env:gemini-2.5-flash)`。
