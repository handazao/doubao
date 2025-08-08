// ==UserScript==
// @name         豆包文件夹链接导出为Excel
// @namespace    doubao-export
// @version      1.1
// @description  提取页面中豆包文件夹链接并导出为Excel文件
// @author       ChatGPT
// @match        https://www.doubao.com/*
// @grant        GM_addStyle
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// ==/UserScript==

(function () {
    'use strict';

    // ===================== 样式注入 =====================
    function injectCustomStyle() {
        const style = document.createElement("style");
        style.textContent = `
      #myDownloadButtonWrapper {
          position: fixed;
          top: 80px;
          right: 10px;
          z-index: 999999;
          background: white;
          padding: 5px 10px;
          border: 1px solid #ccc;
          border-radius: 4px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          cursor: move;
      }
    `;
        document.head.appendChild(style);
    }

    function makeDraggable(element) {
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;

        element.addEventListener("mousedown", (e) => {
            isDragging = true;
            offsetX = e.clientX - element.getBoundingClientRect().left;
            offsetY = e.clientY - element.getBoundingClientRect().top;
            element.style.transition = "none";
            document.body.style.userSelect = "none";
        });

        document.addEventListener("mousemove", (e) => {
            if (!isDragging) return;
            const x = e.clientX - offsetX;
            const y = e.clientY - offsetY;
            element.style.left = x + "px";
            element.style.top = y + "px";
            element.style.right = "auto";
        });

        document.addEventListener("mouseup", () => {
            isDragging = false;
            document.body.style.userSelect = "";
        });
    }

    function insertDownloadButton() {
        const containers = document.querySelectorAll(".container-HhfXJA");
        if (!containers.length) return;

        if (document.getElementById("myDownloadButtonWrapper")) return;

        const lastContainer = containers[containers.length - 1];

        const button = document.createElement("button");
        button.innerText = "导出 Excel";
        button.style.cssText = "padding:6px 12px;cursor:pointer;";
        button.id = "myDownloadButton";

        const wrapper = document.createElement("div");
        wrapper.id = "myDownloadButtonWrapper";
        wrapper.appendChild(button);
        lastContainer.parentNode.insertBefore(wrapper, lastContainer.nextSibling);

        makeDraggable(wrapper);

        button.addEventListener('click', () => {
            const data = [];

            const containers = document.querySelectorAll('div.flex.flex-col');
            containers.forEach(container => {
                const nameSpan = container.querySelector('[data-testid="ai_space_file_item_label"] span');
                const urlSpan = container.querySelector('[data-testid="ai_space_share_list_item_link"] span');
                const name = nameSpan?.innerText.trim();
                const url = urlSpan?.innerText.trim();

                if (name && url && url.startsWith('https://www.doubao.com/drive/s/')) {
                    data.push({ '文件夹名称': name, '分享链接': url });
                }
            });

            if (data.length === 0) {
                alert('未找到任何豆包分享链接！');
                return;
            }

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, '豆包分享');

            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/octet-stream' });

            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = '豆包文件夹链接.xlsx';
            a.click();
        });
    }

    // ===================== SPA 路由监听 =====================
    function observeUrlChange(callback) {
        let oldHref = location.href;
        const body = document.querySelector("body");

        const observer = new MutationObserver(() => {
            if (location.href !== oldHref) {
                oldHref = location.href;
                callback();
            }
        });

        observer.observe(body, { childList: true, subtree: true });
    }

    // 判断当前是否是目标页面
    function isTargetPage() {
        return location.href.startsWith("https://www.doubao.com/chat/drive/share/");
    }

    // 初始化逻辑
    function init() {
        if (!isTargetPage()) return;

        // 避免重复插入
        if (document.getElementById("myDownloadButtonWrapper")) return;

        // 等待目标元素加载完成再插入按钮
        const waitInterval = setInterval(() => {
            if (document.querySelector(".container-HhfXJA")) {
                clearInterval(waitInterval);
                insertDownloadButton();
            }
        }, 500);
    }

    // 启动逻辑
    injectCustomStyle();
    init();

    // 监听 SPA 路由变更
    observeUrlChange(() => {
        setTimeout(() => {
            init();
        }, 800); // 给页面渲染留出时间
    });
})();
