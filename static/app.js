const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    const works = ref([]);
    const exchangeRate = ref({ coinToKrw: 120, krwToCny: 5.3 });
    const filters = ref({ query: '', platform: '', eventType: '' });
    const platformList = ['Lezhin KR', 'Bomtoon', 'Ridibooks', 'Mr.Blue', 'Lezhin US'];

    // 从 Flask API 获取数据
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/products');
        works.value = await res.json();
      } catch (err) {
        console.error('获取作品数据失败', err);
      }
    };

    onMounted(() => {
      fetchProducts();
    });

    // 筛选逻辑
    const filteredWorks = computed(() => {
      return works.value.filter(work => {
        const q = filters.value.query.trim().toLowerCase();
        const matchQuery = !q ||
          work.title_ko.toLowerCase().includes(q) ||
          work.title_zh.toLowerCase().includes(q) ||
          work.history.some(h => h.event_name.toLowerCase().includes(q));

        const matchPlatform = !filters.value.platform || work.platform === filters.value.platform;
        const matchEventType = !filters.value.eventType ||
          work.history.some(h => h.event_type.includes(filters.value.eventType));

        return matchQuery && matchPlatform && matchEventType;
      });
    });

    // 标签样式
    const getPlatformBadge = (p) => {
      const map = {
        'Lezhin KR': 'bg-red-100 text-red-700',
        'Bomtoon': 'bg-rose-100 text-rose-700',
        'Ridibooks': 'bg-blue-100 text-blue-700',
        'Mr.Blue': 'bg-sky-100 text-sky-700',
        'Lezhin US': 'bg-purple-100 text-purple-700'
      };
      return map[p] || 'bg-slate-100 text-slate-700';
    };

    const getEventTypeBadge = (t) => {
      if (t.includes('100%')) return 'bg-emerald-100 text-emerald-800';
      if (t.includes('1c')) return 'bg-amber-100 text-amber-800';
      if (t.includes('2c')) return 'bg-orange-100 text-orange-800';
      if (t.includes('50%')) return 'bg-indigo-100 text-indigo-800';
      return 'bg-slate-100 text-slate-700';
    };

    // 弹窗计算器
    const calculator = ref({ visible: false, work: null, event: null, buyEpisodes: 10 });

    const openCalculator = (work, event) => {
      calculator.value = {
        visible: true,
        work,
        event,
        buyEpisodes: work.total_episodes
      };
    };

    const calcOriginalTotal = computed(() => {
      if (!calculator.value.work) return 0;
      return calculator.value.buyEpisodes * calculator.value.work.original_coin_per_ep;
    });

    const calcDiscountedPay = computed(() => {
      if (!calculator.value.event) return 0;
      return Math.ceil(calculator.value.buyEpisodes * calculator.value.event.pay_coin);
    });

    const calcCashback = computed(() => {
      if (!calculator.value.event) return 0;
      return Math.floor(calcDiscountedPay.value * (calculator.value.event.cashback_ratio || 0));
    });

    const calcNetCoinCost = computed(() => {
      return calcDiscountedPay.value - calcCashback.value;
    });

    const calcCnyCost = computed(() => {
      if (calculator.value.work?.platform === 'Ridibooks') {
        return ((calcNetCoinCost.value / 1000) * exchangeRate.value.krwToCny).toFixed(2);
      }
      const krw = calcNetCoinCost.value * exchangeRate.value.coinToKrw;
      return ((krw / 1000) * exchangeRate.value.krwToCny).toFixed(2);
    });

    // Excel 导入与解析
    const handleImportExcel = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

          const workMap = new Map();
          rows.forEach((row, i) => {
            const platform = row['平台'] || 'Lezhin KR';
            const titleZh = row['作品中文名'] || '未命名作品';
            const titleKo = row['作品韩文名'] || titleZh;
            const key = `${platform}_${titleKo}`;

            if (!workMap.has(key)) {
              workMap.set(key, {
                id: `import-${Date.now()}-${i}`,
                title_ko: String(titleKo),
                title_zh: String(titleZh),
                platform: String(platform),
                currency: platform === 'Ridibooks' ? 'Point/Cash' : 'Coin',
                genre: row['类型'] || 'BL',
                original_coin_per_ep: Number(row['单话原价']) || 3,
                total_episodes: Number(row['总话数']) || 10,
                is_completed: true,
                history: []
              });
            }

            workMap.get(key).history.push({
              event_name: row['活动名称'] || '大促特惠',
              event_type: row['优惠类型'] || '1c 展',
              date: String(row['活动时间'] || '2026'),
              rule_type: Number(row['返还比例']) >= 1.0 ? 'payback_100' : 'direct_discount',
              pay_coin: Number(row['活动单价']) || 1,
              cashback_ratio: Number(row['返还比例']) || 0.0,
              target_episodes: String(row['适用范围'] || '全篇'),
              rule_desc: String(row['规则备注'] || '无')
            });
          });

          const importedWorks = Array.from(workMap.values());
          works.value = importedWorks;

          // 同步给 Flask 后端持久化存储
          await fetch('/api/products/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(importedWorks)
          });

          alert(`成功导入 ${importedWorks.length} 部作品数据并已同步存储！`);
          e.target.value = '';
        } catch (err) {
          console.error(err);
          alert('解析 Excel 失败，请检查文件格式！');
        }
      };
      reader.readAsArrayBuffer(file);
    };

    // 下载模板
    const downloadTemplate = () => {
      const template = [{
        "平台": "Lezhin KR",
        "作品中文名": "西西弗斯的狗",
        "作品韩文名": "시시포스의 개들",
        "类型": "BL",
        "单话原价": 3,
        "总话数": 45,
        "活动时间": "2026-02",
        "活动名称": "2026新春全额返",
        "优惠类型": "100% Coinback",
        "活动单价": 3,
        "返还比例": 1.0,
        "适用范围": "全篇",
        "规则备注": "100%返还Bonus币"
      }];
      const ws = XLSX.utils.json_to_sheet(template);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "导入模板");
      XLSX.writeFile(wb, "韩漫促销导入模板.xlsx");
    };

    return {
      works,
      exchangeRate,
      filters,
      platformList,
      filteredWorks,
      getPlatformBadge,
      getEventTypeBadge,
      calculator,
      openCalculator,
      calcOriginalTotal,
      calcDiscountedPay,
      calcCashback,
      calcNetCoinCost,
      calcCnyCost,
      handleImportExcel,
      downloadTemplate
    };
  }
}).mount('#app');
