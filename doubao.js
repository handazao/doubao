// ==UserScript==
// @name         豆包AI网盘增强
// @namespace    https://www.doubao.com/
// @version      2025-08-07
// @description  关键词 + 排序
// @match        https://www.doubao.com/drive/*
// @match        https://www.doubao.com/chat/drive/*
// @grant        GM_xmlhttpRequest
// @connect      doubao.com
// @license MIT
// @downloadURL https://update.greasyfork.org/scripts/544265/%E8%B1%86%E5%8C%85AI%E7%BD%91%E7%9B%98%E5%A2%9E%E5%BC%BA.user.js
// @updateURL https://update.greasyfork.org/scripts/544265/%E8%B1%86%E5%8C%85AI%E7%BD%91%E7%9B%98%E5%A2%9E%E5%BC%BA.meta.js
// ==/UserScript==

(function () {
  "use strict";

  // ===================== 样式注入 =====================
  function injectCustomStyle() {
    const style = document.createElement("style");
    style.textContent = `
        .left-column-t5w32g {
            min-width: 480px !important;
            flex-grow: 0 !important;
        }

        #mySearchBoxWrapper {
            position: fixed;
            top: 80px;
            right: 10px;
            z-index: 999999;
            background: white;
            padding: 5px 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            cursor: move; /* 鼠标样式改为可拖动 */
        }


        `;
    document.head.appendChild(style);
  }

  // ===================== 工具函数 =====================
  function createCheckboxColumn(id, checked = false) {
    const wrapper = document.createElement("div");
    wrapper.className = "check-box-wrapper-Ed2ep5";

    // 创建复选框
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id || `checkbox-${Date.now()}`; // 用传入的 id，否则生成一个唯一 id
    checkbox.checked = checked; // 按参数设置是否选中

    wrapper.appendChild(checkbox);

    return wrapper;
  }


  function formatSize(size) {
    if (!size) return "-";
    if (size > 1 << 30) return (size / (1 << 30)).toFixed(2) + " GB";
    if (size > 1 << 20) return (size / (1 << 20)).toFixed(2) + " MB";
    if (size > 1 << 10) return (size / (1 << 10)).toFixed(2) + " KB";
    return size + " B";
  }

  function formatDuration(seconds) {
    if (!seconds) return "-";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h${m}m${s}s`;
  }

  function getFileExtension(name) {
    if (!name) return "-";
    const parts = name.split(".");
    return parts.length > 1 ? parts.pop().toUpperCase() : "-";
  }

  function getAiStatus(status) {
    switch (status) {
      case 0:
        return "未处理";
      case 1:
        return "分析中";
      case 2:
        return "完成";
      case 3:
        return "失败";
      default:
        return "未知";
    }
  }

  function makeDraggable(element) {
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    element.addEventListener("mousedown", (e) => {
      isDragging = true;
      offsetX = e.clientX - element.getBoundingClientRect().left;
      offsetY = e.clientY - element.getBoundingClientRect().top;
      element.style.transition = "none"; // 拖动时禁用动画
      document.body.style.userSelect = "none"; // 禁止选中文字
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const x = e.clientX - offsetX;
      const y = e.clientY - offsetY;
      element.style.left = x + "px";
      element.style.top = y + "px";
      element.style.right = "auto"; // 移除原来 right 的限制
    });

    document.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.userSelect = "";
      }
    });
  }

  // ===================== 数据列渲染 =====================
  function createRightColumn(text, options = {}) {
    const colWrapper = document.createElement("div");
    colWrapper.className = "right-column-dCUG0O flex items-center";
    if (options.extended) colWrapper.dataset.extended = "true";

    const inner = document.createElement("div");
    inner.className = "update-time-PWmLSY";
    inner.textContent = text || "-";
    if (options.minWidth) inner.style.minWidth = options.minWidth;

    colWrapper.appendChild(inner);
    return colWrapper;
  }

  // ===================== 显示隐藏的文件 =====================
  function appendMissingRows(missFileList) {
    // ✅ 清除上一次自己插入的行
    removeInjectedRows();
    const container =
      document.querySelector(".children-wrapper-Ck8u3i") ||
      document.querySelector("children-wrapper");
    if (!container) return;

    missFileList.forEach((item) => {
      const id = item.id;
      const exists = container.querySelector(
        `[data-ai-space-file-item="row_${id}"]`
      );
      if (!exists) {
        const row = createFileRow(item);
        container.appendChild(row);
      }
    });
  }

  function renderFileRows(fileList) {
    const missFileList = [];

    waitForRows(3, 300)
      .then((rows) => {
        // 建立 rowMap: id => DOM 行
        const rowMap = new Map();
        rows.forEach((row) => {
          const container = row.closest("[data-ai-space-file-item]");
          const rowId = container
            ?.getAttribute("data-ai-space-file-item")
            ?.replace("row_", "");
          if (rowId) rowMap.set(rowId, row);
        });

        fileList.forEach((item) => {
          if (!item?.id) return;

          const row = rowMap.get(item.id);
          if (row) {
            if (row.dataset.extended) return;
            row.dataset.extended = "true";

            if (window.__isShare__) {
              const checkbox = createCheckboxColumn(item.id);
              checkbox.querySelector('input[type="checkbox"]').checked = false;
              row.insertBefore(checkbox, row.firstChild);
            }
            row.appendChild(
              createRightColumn(formatSize(item.size), { minWidth: "10px" })
            );
            row.appendChild(
              createRightColumn(formatDuration(item.content?.duration), {
                minWidth: "10px",
              })
            );
            row.appendChild(
              createRightColumn(getAiStatus(item.content?.ai_skill_status), {
                minWidth: "10px",
              })
            );
          } else {
            missFileList.push(item);
          }
        });

        //appendMissingRows(missFileList);
      })
      .catch((err) => {
        //console.warn('[文件行加载超时]', err);
        //resetListAsnFbtWithCustomContent(fileList);
      });
  }

  // ===================== 等待文件行渲染 =====================
  function waitForRows(maxRetries = 3, delay = 300) {
    return new Promise((resolve, reject) => {
      let attempts = 0;

      const tryFind = () => {
        const rows = document.querySelectorAll(
          ".file-row-wrapper-vFCVDk:not(.header-CvSd1B)"
        );
        if (rows.length > 0) {
          return resolve(rows);
        }

        attempts++;
        if (attempts >= maxRetries) {
          return reject("文件行未渲染完成，超出最大重试次数");
        }

        setTimeout(tryFind, delay);
      };

      tryFind();
    });
  }


  function insertSearchBox() {
    const containers = document.querySelectorAll(".container-upw8nU");
    if (!containers.length) return;

    const lastContainer = containers[containers.length - 1];
    const existing = document.getElementById("mySearchBoxWrapper");
    if (existing) existing.remove();

    const sortSelect = document.createElement("select");
    sortSelect.id = "mySortSelect";
    sortSelect.style.margin = "10px 10px 10px 0";
    sortSelect.style.padding = "6px";

    const options = [
      { value: "name_asc", label: "文件名 升序" },
      { value: "name_desc", label: "文件名 降序" },
      { value: "time_asc", label: "修改时间 升序" },
      { value: "time_desc", label: "修改时间 降序" },
    ];
    options.forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = opt.label;
      sortSelect.appendChild(option);
    });

    sortSelect.addEventListener("change", () => {
      const keywordInput = document.getElementById("mySearchBox");
      const keyword = keywordInput ? keywordInput.value.trim().toLowerCase() : "";
      const sortRule = sortSelect.value;
      if (window.__allFileData__) {
        const filtered = filterByKeyword({ children: window.__allFileData__ });
        const sorted = sortFileList(filtered);
        renderFileRows(sorted, window.__isMine__);
      }
    });

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "请输入关键词";
    input.style.cssText =
      "margin:10px 10px 10px 0;padding:6px;border:1px solid #ccc;border-radius:4px;";
    input.id = "mySearchBox";

    const searchBtn = document.createElement("button");
    searchBtn.innerText = "执行";
    searchBtn.style.cssText = "padding:6px 12px;cursor:pointer;margin-right:10px;";
    searchBtn.onclick = () => {
      const val = input.value.trim();
      const allcontainers = document.querySelectorAll(".container-zLcYj3");
      if (!allcontainers.length) return;
      const lastContainers = allcontainers[allcontainers.length - 1];
      lastContainers.click();
    };

    const wrapper = document.createElement("div");
    wrapper.id = "mySearchBoxWrapper";
    wrapper.style.marginLeft = "auto";
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.appendChild(sortSelect);
    wrapper.appendChild(input);
    wrapper.appendChild(searchBtn);

    lastContainer.parentNode.insertBefore(wrapper, lastContainer.nextSibling);
  }

  // 关键词过滤逻辑
  function filterByKeyword(data) {
    const inputEl = document.getElementById("mySearchBox");
    const keyword = inputEl?.value?.trim().toLowerCase();

    if (!keyword) return data?.children || [];
    if (!data || !Array.isArray(data.children)) return [];

    return data.children.filter((item) =>
      item?.name?.toLowerCase()?.includes(keyword)
    );
  }

  /**
   * 根据指定字段对文件数组排序
   * @param {Array} data - 文件数组
   * @returns {Array} 排序后的数组（原地排序）
   */
  function sortFileList(data) {
    if (!Array.isArray(data)) return data;

    const select = document.getElementById("mySortSelect");
    if (!select) return data;

    const value = select.value; // 如 "name_asc" 或 "time_desc"
    const [field, order] = value.split("_"); // 分割为 "name" 和 "asc"
    const isAsc = order === "asc";

    data.sort((a, b) => {
      let valA, valB;

      if (field === "name") {
        valA = a.name?.toLowerCase() || "";
        valB = b.name?.toLowerCase() || "";
        return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      if (field === "time") {
        valA = a.update_time || 0;
        valB = b.update_time || 0;
        return isAsc ? valA - valB : valB - valA;
      }

      return 0;
    });

    return data;
  }

  // XHR 拦截
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (...args) {
    this._method = args[0];
    this._url = args[1];
    this._async = args[2] !== false;
    return originalOpen.apply(this, args);
  };

  XMLHttpRequest.prototype.send = function (body) {
    const xhr = this;

    // ---- 分享保存 请求拦截并改参数 ----
    if (xhr._url && xhr._url.includes("/samantha/aispace/share/dump")) {
      // 保存逻辑
      const checkedIds = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
        .map(cb => cb.getAttribute("data-id") || cb.id)
        .filter(id => id); // 过滤掉 null 或空值

      //console.log("选中的ID:", checkedIds);
      // 没有选中则直接发送原请求
      if (!checkedIds.length) {
        return originalSend.call(xhr, body);
      }
      // 转换成 node_list 格式
      const nodeList = checkedIds.map(id => ({ id }));

      try {
        let requestData = JSON.parse(body || "{}");

        // 修改参数
        requestData.node_list = nodeList;
        //console.log("✅ 已修改 dump 请求参数:", requestData);
        return originalSend.call(xhr, JSON.stringify(requestData));
      } catch (err) {
        //console.error("❌ dump 参数修改失败:", err);
        return originalSend.call(xhr, body);
      }
    }


    // ---- 分享保存 请求拦截并改参数 ----
    //xhr._url.includes("/samantha/aispace/share/overvie") ||
    const shouldIntercept =
      xhr._url &&
      (xhr._url.includes("/samantha/aispace/share/node_info") ||
        xhr._url.includes("/samantha/aispace/node_info"));

    if (!shouldIntercept) return originalSend.call(xhr, body);

    try {

      window.__isShare__ = xhr._url.includes("/samantha/aispace/share");

      const requestData = JSON.parse(body || "{}");

      const allChildren = [];
      let nextCursor = null;

      async function fetchAllPages() {
        let hasMore = true;
        let first = true;

        while (hasMore) {
          const reqPayload = { ...requestData };
          if (!first && nextCursor) {
            reqPayload.cursor = nextCursor;
          }

          first = false;

          const res = await sendGMRequest(reqPayload);
          const json = JSON.parse(res.responseText);

          const children = json?.data?.children || [];
          const cursor = json?.data?.next_cursor;
          const more = json?.data?.has_more;

          allChildren.push(...children);
          //console.log(`📦 拉取了 ${allChildren.length} 条, next_cursor=${cursor}, has_more=${more}`);

          hasMore = more === true;
          nextCursor = cursor;
        }

        // ✅ 构造完整响应结构
        const fakeResponse = {
          code: 0,
          msg: "",
          data: {
            node_info: {},
            children: allChildren,
            next_cursor: null,
            has_more: false,
          },
        };

        const filtered = filterByKeyword(fakeResponse.data);
        if (filtered) {
          const sorted = sortFileList(filtered);
          fakeResponse.data.children = sorted;
        }
        renderFileRows(fakeResponse.data.children);

        const jsonText = JSON.stringify(fakeResponse);

        Object.defineProperty(xhr, "responseText", {
          get: () => jsonText,
        });
        Object.defineProperty(xhr, "status", { get: () => 200 });
        Object.defineProperty(xhr, "readyState", { get: () => 4 });

        if (typeof xhr.onreadystatechange === "function")
          xhr.onreadystatechange();
        xhr.dispatchEvent(new Event("readystatechange"));
        xhr.dispatchEvent(new Event("load"));
        xhr.dispatchEvent(new Event("loadend"));
      }

      function sendGMRequest(payload) {
        return new Promise((resolve, reject) => {
          GM_xmlhttpRequest({
            method: "POST",
            url: xhr._url,
            headers: {
              "Content-Type": "application/json",
            },
            data: JSON.stringify(payload),
            onload: resolve,
            onerror: reject,
          });
        });
      }

      fetchAllPages().catch((err) => {
        //console.error("[分页拉取失败]", err);
      });

      return; // 阻止原始 XHR 请求
    } catch (e) {
      //console.warn("[XHR 拦截失败]", e);
    }

    return originalSend.call(xhr, body); // fallback
  };

  // ===================== 页面加载完成后执行 =====================
  function waitForElement(selector, callback) {
    const targetNode = document.body;
    const observer = new MutationObserver((mutations, obs) => {
      const el = document.querySelector(selector);
      if (el) {
        obs.disconnect(); // 停止观察
        callback(el);
      }
    });

    observer.observe(targetNode, {
      childList: true,
      subtree: true,
    });
  }

  // ===================== 启动脚本 =====================
  injectCustomStyle();
  // 等待 .container-upw8nU 出现后插入搜索框
  waitForElement(".container-upw8nU", () => {
    if (!document.getElementById("mySearchBoxWrapper")) {
      insertSearchBox();
      makeDraggable(document.getElementById("mySearchBoxWrapper"));
    }
  });
})();
