const API_URL = "https://graphql.anilist.co";
let slideIdx = 0;
let slideTimer;

function showPage(pageId) {
  // 1. Sembunyikan semua halaman
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });

  // 2. Tampilkan halaman yang dituju
  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.add("active");
  }

  // 3. Reset Scroll ke atas
  window.scrollTo({ top: 0, behavior: "smooth" });

  // 4. KHUSUS: Jika balik ke Home, jalankan ulang slider agar tidak freeze atau numpuk
  if (pageId === "home-page") {
    startAutoSlide();
  } else {
    // Hentikan timer slider jika tidak di home untuk hemat memori
    clearInterval(slideTimer);
  }
}

function toggleLoader(s) {
  document.getElementById("loader").style.display = s ? "flex" : "none";
}

async function translateText(t) {
  if (!t) return "Sinopsis tidak tersedia.";
  try {
    const r = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=id&dt=t&q=${encodeURI(t.replace(/<\/?[^>]+(>|$)/g, ""))}`,
    );
    const j = await r.json();
    return j[0].map((x) => x[0]).join("");
  } catch (e) {
    return t;
  }
}

async function initHome() {
  toggleLoader(true);
  showPage("home-page");
  const q = `query { 
        slider: Page(perPage: 5) { media(type: ANIME, sort: TRENDING_DESC) { id title { romaji } description bannerImage coverImage { extraLarge } } }
        recent: Page(perPage: 12) { airingSchedules(airingAt_lesser: ${Math.floor(Date.now() / 1000)}, sort: TIME_DESC) { episode media { id title { romaji } averageScore coverImage { large } } } }
    }`;
  try {
    const r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q }),
    });
    const j = await r.json();
    const d = j.data;

    document.getElementById("hero-slider").innerHTML = d.slider.media
      .map(
        (a, i) => `
            <div class="slide ${i === 0 ? "active" : ""}" style="background-image: url('${a.bannerImage || a.coverImage.extraLarge}')">
                <div class="hero-content">
                    <h1>${a.title.romaji}</h1>
                    <p>${a.description ? a.description.replace(/<\/?[^>]+(>|$)/g, "") : "Tonton anime seru ini sekarang di Aniger."}</p>
                    <button class="btn-play" onclick="loadDetail(${a.id})"><i class="fas fa-play-circle"></i> MULAI NONTON</button>
                </div>
            </div>
        `,
      )
      .join("");

    document.getElementById("trending-list").innerHTML =
      d.recent.airingSchedules
        .map(
          (i) => `
            <div class="anime-card" onclick="loadDetail(${i.media.id})">
                <div class="card-image-wrapper">
                    <img src="${i.media.coverImage.large}">
                    <div class="badge-hot">HOT</div>
                    <div class="badge-rating"><i class="fas fa-star"></i> ${(i.media.averageScore / 10).toFixed(1)}</div>
                    <div class="ep-overlay">Eps. ${i.episode}</div>
                </div>
                <div class="card-info"><h3>${i.media.title.romaji}</h3></div>
            </div>
        `,
        )
        .join("");
    startAutoSlide();
  } catch (e) {
    console.error(e);
  } finally {
    toggleLoader(false);
  }
}

async function loadDetail(id) {
  toggleLoader(true);
  const q = `query($id:Int){ Media(id:$id){ id title{romaji} description genres episodes averageScore recommendations(perPage:6){ nodes{ mediaRecommendation{ id title{romaji} averageScore coverImage{large} } } } } }`;
  try {
    const r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q, variables: { id } }),
    });
    const j = await r.json();
    const a = j.data.Media;
    const sinopsis = await translateText(a.description);

    document.getElementById("detail-content").innerHTML = `
            <div class="player-grid">
                <div>
                    <div class="video-wrapper"><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" allowfullscreen></iframe></div>
                    <div class="info-box">
                        <h1>${a.title.romaji}</h1>
                        <div style="margin:10px 0; display:flex; gap:10px;">
                            ${a.genres
                              .slice(0, 3)
                              .map(
                                (g) =>
                                  `<span style="background:var(--primary); font-size:11px; padding:3px 12px; border-radius:20px;">${g}</span>`,
                              )
                              .join("")}
                        </div>
                        <p style="color:#bbb; font-size:14px; margin-top:15px;">${sinopsis}</p>
                    </div>
                </div>
                <div class="info-box" style="margin-top:0">
                    <h3>Episode</h3>
                    <div class="ep-list">${Array.from({ length: a.episodes || 12 }, (_, i) => `<div class="ep-item">Eps ${i + 1} <i class="fas fa-play"></i></div>`).join("")}</div>

                </div>
            </div>
        `;

    document.getElementById("recommendation-list").innerHTML =
      a.recommendations.nodes
        .map((n) => {
          const rec = n.mediaRecommendation;
          if (!rec) return "";
          return `
                <div class="anime-card" onclick="loadDetail(${rec.id})">
                    <div class="card-image-wrapper">
                        <img src="${rec.coverImage.large}">
                        <div class="badge-rating"><i class="fas fa-star"></i> ${(rec.averageScore / 10).toFixed(1)}</div>
                    </div>
                    <div class="card-info"><h3>${rec.title.romaji}</h3></div>
                </div>
            `;
        })
        .join("");

    showPage("detail-page");
  } catch (e) {
    console.error(e);
  } finally {
    toggleLoader(false);
  }
}

async function loadCategory(s, t) {
  toggleLoader(true);
  const q = `query($s:[MediaSort]){ Page(perPage:18){ media(type:ANIME, sort:$s){ id title{romaji} averageScore coverImage{large} } } }`;
  try {
    const r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q, variables: { s: [s] } }),
    });
    const j = await r.json();
    renderList(t, j.data.Page.media);
    if (t === "Populer")
      document.getElementById("m-pop").classList.add("active");
  } catch (e) {
    console.error(e);
  } finally {
    toggleLoader(false);
  }
}

async function loadSchedule() {
  toggleLoader(true);
  const q = `query{ Page(perPage:18){ airingSchedules(airingAt_greater:${Math.floor(Date.now() / 1000)}, sort:TIME){ media{ id title{romaji} averageScore coverImage{large} } episode } } }`;
  try {
    const r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q }),
    });
    const j = await r.json();
    renderList(
      "Jadwal Rilis",
      j.data.Page.airingSchedules.map((x) => ({
        ...x.media,
        episode: x.episode,
      })),
    );
    document.getElementById("m-jad").classList.add("active");
  } catch (e) {
    console.error(e);
  } finally {
    toggleLoader(false);
  }
}

function renderList(t, d) {
  document.getElementById("category-title").innerText = t;
  document.getElementById("category-list").innerHTML = d
    .map(
      (a) => `
        <div class="anime-card" onclick="loadDetail(${a.id})">
            <div class="card-image-wrapper">
                <img src="${a.coverImage.large}">
                <div class="badge-rating"><i class="fas fa-star"></i> ${(a.averageScore / 10).toFixed(1)}</div>
                ${a.episode ? `<div class="ep-overlay">Eps. ${a.episode}</div>` : ""}
            </div>
            <div class="card-info"><h3>${a.title.romaji}</h3></div>
        </div>
    `,
    )
    .join("");
  showPage("category-page");
}

async function handleSearch(e) {
  if (e.key === "Enter" && e.target.value.trim() !== "") {
    toggleLoader(true);
    const q = `query($s:String){ Page(perPage:18){ media(search:$s, type:ANIME){ id title{romaji} averageScore coverImage{large} } } }`;
    try {
      const r = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, variables: { s: e.target.value } }),
      });
      const j = await r.json();
      renderList(`Hasil: ${e.target.value}`, j.data.Page.media);
    } catch (e) {
      console.error(e);
    } finally {
      toggleLoader(false);
    }
  }
}

function sendChat() {
  const input = document.getElementById("msgInput");
  if (input.value.trim() !== "") {
    const chatBox = document.getElementById("chat-messages");
    const div = document.createElement("div");
    div.className = "msg";
    div.innerHTML = `<b>User_${Math.floor(Math.random() * 999)}</b>${input.value}`;
    chatBox.appendChild(div);
    input.value = "";
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}

function startAutoSlide() {
  if (slideTimer) clearInterval(slideTimer);
  slideTimer = setInterval(() => {
    const s = document.querySelectorAll(".slide");
    if (s.length < 2) return;
    s[slideIdx].classList.remove("active");
    slideIdx = (slideIdx + 1) % s.length;
    s[slideIdx].classList.add("active");
  }, 5000);
}

let totalComments = 0;

function showActions() {
  document.getElementById("comment-actions").style.display = "flex";
}

function hideActions() {
  document.getElementById("comment-actions").style.display = "none";
  document.getElementById("animeInput").value = "";
}

function postDetailComment() {
  const input = document.getElementById("animeInput");
  const container = document.getElementById("detail-comments-list");
  const countLabel = document.getElementById("commentCount");

  if (input.value.trim() !== "") {
    const div = document.createElement("div");
    div.className = "minimal-item";

    const user = "User_" + Math.floor(Math.random() * 999);

    div.innerHTML = `
            <div class="avatar-sm" style="background: hsl(${Math.random() * 360}, 50%, 50%)"></div>
            <div class="comment-info">
                <b>${user}</b> <span>Baru saja</span>
                <p>${input.value}</p>
            </div>
        `;

    container.insertBefore(div, container.firstChild);

    totalComments++;
    countLabel.innerText = totalComments;

    input.value = "";
    hideActions();
  }
}

window.onload = initHome;
