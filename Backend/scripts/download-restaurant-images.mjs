// One-off script: downloads the restaurant/dish photos currently hotlinked
// from lh3.googleusercontent.com (Google's prototype-hosting CDN, an
// external dependency this app doesn't control) into src/assets/images so
// the backend can serve them itself. Run once with `node scripts/download-restaurant-images.mjs`,
// not part of the normal server startup.
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'src', 'assets', 'images', 'restaurants');

const IMAGES = {
  haveli: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB-N3sZ_BCk5VFtATHaCWc9vilNvyR9_xdBxneokza5aIpkYBWtWM2lUwkq0AnFEov-Bp2kpXrxUCWOn2RWV4BSeWafwpJ33NpdNmjZSt0LAS_tFCCmghmSVKcv0zrDPRd3yz_BnQV9Jde9hrcrnpHNPUlsf9IegzcWeRG3qZhmu2_s4HPe4VZONLmy48Sn3diRG3mVn5C-agh0XY3oeMrEVUeGT-QoGgohdQ-IAPA74IXlVQ9HeWX7',
  haveliChickenKarahi: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBgxwHEb-scErxpkoWBSguEMwunFqMsNm3bsXEMePb-Mjov2SKWmDHrddb6QGISHueZL-HM9a5znW3Bkz1yqpIVd0mzrd703fXJ18kJwHabOzulMMx6tK7CYc6Vfp7d_U1j1YmqfG2iQF_SfriYbrzeY0fZINhk0JhWmM7ohZUoySSS4wt-MRsvahYGADtYFp7nYd_K317yWLf_mhzivgfrrjVAr-gGl8OjEeeJCZwaAiGeIMWBxPqs',
  haveliMuttonKarahi: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAeuQReZdUaL4gt73hM1Gb5bMDhpcCzGqn7b7ng_ljb3250UjJD7ogBq322u7jLSChb19nCe3-4OcdaNb-fX6FErOTrmo4DEd0gXNBvn0WkR3pyYagVxIM682iJwbDrteWhIeHdVbAhVXWkXe_GgSd5XyWAZzQcjlS-cBQ9VGa4lHcGrDnJ-zhDrjIvmzEBWnu2oYY3rDnewemCbqSbY_X5hy0lLfJy3_7HiMBc74E1eihRfnU5dauf',
  haveliSeekhKebab: 'https://lh3.googleusercontent.com/aida-public/AB6AXuClpr5QukQPnBEuFn7eXYRIq2rDDl9BxW1uUnz7YwapDc28YzvGbpVSA1HpURce3wisc5ztsaXity-_hnsKsUFCPryjgPR-PshG-FKl8eTAudYi9Dch-sBeURbx0pGEN8n7JfW6q0dNFHRlO1vH9khQHbIo58HF-iau0TbhPSdkqJ4yAjzMrdj2mX7n2KryO_fyAYUEFRXFtRv4968rhTI5FCBESjgpEo0u3XguDPV71y8DORa4FgXq',
  haveliBbqPlatter: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD9S2K_hqHdI-eQFxhRbW7_EgCIlMcQb5H6Vi7RJSptl-FvEYQ_fGGy4cKoI4JxI5qCEA_w_6sAsmZxxDUROnyF1yAd_oE3uNcT9mNLdiPASDyi6I-kDHeunPSSP9degDNscseVfZyYHXtOvydaAIEDgsanecXLIybrUbAg-GXvLLg0IXI80QJSFovaiMp77Vwu44B-vRdFBzllylauSJw1AxSD3ytGm4k_hD5L98DtfPCgP8RDoaRo',
  haveliKheer: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB7hkVvX2dD-_4sE8Nj_ylVGReP6UOjqdCbAsc7ujGVoPNPmMG4jzcwhquzNMxAvXvDbmOu38s-PbbRbNV0PlT2B1KmDsPkpHJp2filqb0itxCNH05GYmOGV3BnPotNpy3PRNgSvVWQqep4qc59g66gHmpTKizUcKK-fLF0dNJ_51PwtUaYW3UKoHQ1SejE_21_U8q2ATBQuvFKavIgUFEVxVGE00x0sg6kBn5yJ6a2YuutUZUXiLA6',
  kolachi: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD1GxHh8jZZ8hfGYve-BngWCr78b09nXeGrBo8gVwlxDonqA1vGgD7NMoW8gc81UEs6U4T2JZNfZrpVjv9PU76tY2KTlc9np2wSUPmaPhi9fNM3-AwYyrjcCZQgwJnagdRZaHPhArKCoguTfm-eTDVKKAlQH45Lv2NEzwDmjOQ7kzD-QJG01fJXFs6OkSHDREc7y8_9QBJLNG27ef_puOuUJmBAt5N4jfCDIKh8jv_4daNy_Aw8KeH-',
  kolachiMuttonKarahi: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCNb0ViTDNA-Rd8kGbm9kT4oZ5hMhe8rIexDB2YDJm6wSLSnk8spww8B58AMw-lKGquabmCBi-NmzYaFPeCHSdJaIb7SUxwBO_1oruK6cHUCvR3Xx-i04MfH14kETP1mJQsaKSwdC-5RcHllVbrmODu4ZjPuTBaTWIPzzmBAwD-hLNNr3PptQ90thMndCySyOZo_f657jThlxFh_4tIoDB27YkPpP5cMfhQF9SSkB37tAXVPa_6scPG',
  xanders: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCnRfWMXtZULLasq97TnexrGq-RjojFZrwpoB800T7UwPagSRacgRyS_mcMPS5uVFRJHxrVS3WPEE3yW1fq0eJvKyWSmB-lTDD9NruiwXTIH3YjhD7HCY4EToDJa-MMdfpzIpZKWKsjyTY2DKQumPJoVpaRJ_vV5Qo3bHFg9h1pC_GZy5WwFMSlnAYUnkp9CbVX3mFM99cKNyEJeK8ENXIBkBeZecW6BFPP0KkZTTPBXCNIyvKPzSS6',
  javedNihari: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBJcFe5jzU5c4Brmv_vlc7NZylHGGCPyUytvxVsFIBZKLfqbnVjKocHlyeHsG2f9VzvPtIP4AkzFejxEM7VB6xocoHxqjBqJStFA1kcPrsv8vMnQQTOygPM4PVYvHrgVNTdM9MBqhB8EyjQQ3uUhLjtqp_sQr_g69gBGaJg-3QIimmzgED7JEInHGEo1N-RVRUapaxgoFeRF3u6tVBGp0eMMWBPypaxcHpsMPAsRyRe7Jr0vp03bjpT',
  studentBiryani: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAyaPbO9Aq7P6CZCm6yKXElRgzADr7ZzYNajxG2GTyBVtHJJXpgfT2QUsBC63G9mj3qtSkg4uuJqHjA35Ttrk_-Vsq9zmH2HZx8xQkAyHWpJl108MoxB4A8WHG0OlIFSg0cWMyliXIRkfnOdwDfC4Gn545XbOWaAhwUPgEx4hiHoRc0KstcAo1Nihc5pkC5Xg7YOwJZJAkKkYaJLguwWYKyfnm9qhFJKU5EolQNLIUxxFcsPjz6a4Ji',
  desiCourtyard: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBQZ77LKd-VTH23N8NhbFjORHLsOuxHe5RHYrM2rjdvSCU8lt_LyqdrHKmSUMtEoZ15UFPd9KpEQbLjPd-9pzPpDYzAjnZdDJUUnapA26--uuyDO-UcGu8ki7RlLW6srHDMHfDVQ2viwT-4Nbavo4hAzYko_KIszXhjMh_4__hg5QpeVNTGwEPH7s3t4HJ0opvb1oX6AAsQVmfWJk0XIDswsRQRytL9181e1bbHwV7LVs06slz4c7aI',
  desiCourtyardChickenKarahi: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA0XqoAQcLlTQnk3pftNKva2hunc8RGl2k4d8WBswXzlJSjK-s7b20j-kcedZWx2lVMPhBB153Y6Jml3SiMMkgAr3dUCscACo13AXfRXg34JYanPUQDd26alaHohZ1HXmMT0o4luxrxMOweW3efBmE_xl-nv8ZStn3T9lvDj9o19nTDyNEoQflmhrs9elOzE60sFvLQIPXnKYheibkM299qBbDx_QH-pTMX9Y9BrgO1_FBGdceIQq_y',
  desiCourtyardSeekhKebab: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBN1pEVZwdDrZC2upy1_JMr0Sbr48TCnq1E6QMubSFOjnnRprHVA1DeNXxiEOiVDNrxM6aQE56UTNyAqc00Uyow5GovwnmK1pdZ0lSxlaX7sSOQY17oqrBLp_4TDMjKOj2HbUEpobLdDoxs8lEVf901NiLpVS37wjQsUgzbQm2iNHHRdDzMhYZxdh_O6a8HfKEwHVJS7tSg98CrmsejOMtY7GLpZ-YNACbTf8h7rpuByg94dagDLsoI',
  desiCourtyardKheer: 'https://lh3.googleusercontent.com/aida-public/AB6AXuATztXWfmkwT2JdtFUaLSj_EnFO2eP9Vvj72dXJzFC7qezDiNHf_LlFyybwCFdMLM8srurDYDK1q9sAZBWJ_9dJM39mFcvydBCcI4Tw8lPFgsrucS6ECaAfSQaTwXqR_8BkYcMyN1Rckku8e9MKw491vdp8PFfWFmtmFT2agaRnEkdtT5NuxIjy2dpY1P1lszPM8JSgciC8ej_VhWFN4HQrIchS4EeI619UgRucQv-tdZiOUuyo-WFT',
};

await mkdir(OUT_DIR, { recursive: true });

const manifest = {};
for (const [key, url] of Object.entries(IMAGES)) {
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`FAILED ${key}: HTTP ${response.status}`);
    continue;
  }
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const buffer = Buffer.from(await response.arrayBuffer());
  const filename = `${key}.${ext}`;
  await writeFile(path.join(OUT_DIR, filename), buffer);
  manifest[key] = filename;
  console.log(`OK ${key} -> ${filename} (${buffer.length} bytes)`);
}

console.log('\nManifest (paste into restaurants.js seed if needed):');
console.log(JSON.stringify(manifest, null, 2));
