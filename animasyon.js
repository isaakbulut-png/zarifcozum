// Sitenin her yerinde kullanabileceğiniz ortak animasyon motoru
function animasyonOynat(kutuId, animasyonLinki, tekrarEt = true) {
    lottie.loadAnimation({
        container: document.getElementById(kutuId),
        renderer: 'svg',
        loop: tekrarEt,
        autoplay: true,
        path: animasyonLinki
    });
}
