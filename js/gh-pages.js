
function getLatestGHRelease(repo, callback) {
    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function () {
        if (this.readyState === 4 && this.status === 200) {
            var release = JSON.parse(this.responseText);
            callback(release);
        }
    };

    xhr.open("GET", "https://api.github.com/repos/gchristensen/" + repo + "/releases/latest");
    xhr.send();
}

function setDownloadLink(release, ext, elementId) {
    var asset;

    for (var i = 0; i < release.assets.length; ++i)
        if (release.assets[i].name.indexOf(ext) >= 0) {
            asset = release.assets[i];
            break;
        }

    var link = document.getElementById(elementId);
    link.href = asset.browser_download_url;
}

function playProductVideo(placeholderId, videoId, duration) {
    document.getElementById(placeholderId).style.display = "none";
    document.getElementById('webm').style.display = "block";

    var video = document.querySelector("#" + videoId + " video");
    video.play();

    setTimeout(function () {
        document.getElementById(videoId).style.display = "none";
        document.getElementById(placeholderId).style.display = "block";
    }, duration);
}

function delayedPlayProductVideo(placeholderId, videoId, duration, delay) {
    setTimeout(function () {
        if (navigator.userAgent.search("Chrome") >= 0
            || navigator.userAgent.search("Firefox") >= 0
            || navigator.userAgent.search("Safari") >= 0) {
            playProductVideo(placeholderId, videoId, duration);
        }
    }, delay);
}