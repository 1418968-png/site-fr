(function () {
  function renderPriceChart({ canvasSelector, emptySelector, series, label }) {
    const canvas = document.querySelector(canvasSelector);
    const empty = document.querySelector(emptySelector);
    if (!canvas || !empty) return;

    if (!Array.isArray(series) || series.length === 0 || !window.Chart) {
      canvas.hidden = true;
      empty.hidden = false;
      empty.textContent = "История цены пока недоступна.";
      return;
    }

    const labels = series.map((point) => point.date || point.label || "");
    const values = series.map((point) => Number(point.close ?? point.value ?? point.price));
    const hasValues = values.some((value) => Number.isFinite(value));

    if (!hasValues) {
      canvas.hidden = true;
      empty.hidden = false;
      empty.textContent = "История цены пока недоступна.";
      return;
    }

    canvas.hidden = false;
    empty.hidden = values.filter((value) => Number.isFinite(value)).length >= 2;
    empty.textContent = "Недостаточно истории для полноценного графика, данные начнут накапливаться после обновлений.";

    new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label,
            data: values,
            borderColor: "#16864c",
            backgroundColor: "rgba(22, 134, 76, 0.12)",
            fill: true,
            tension: 0.25,
            pointRadius: 2,
            pointHoverRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { mode: "index", intersect: false }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxTicksLimit: 6 }
          },
          y: {
            beginAtZero: false,
            ticks: { maxTicksLimit: 6 }
          }
        }
      }
    });
  }

  window.InvestNavigatorCharts = {
    renderPriceChart
  };
})();
