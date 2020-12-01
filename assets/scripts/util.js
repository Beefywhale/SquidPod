const {
  existsSync,
  appendFileSync,
  readFileSync,
  writeFileSync,
} = require("fs");

const { ipcRenderer, shell } = require("electron");

let data;
let buttonSpam = false;
let podcastsLoaded = false;
let notificationsLocal = [];
let notificationCurrent;
let currentEpisode;

const audioPlayer = document.getElementById("audio-player");

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WARNING = "warn";
const ERROR = "error";
const podcastPath = ipcRenderer.sendSync("get-path") + "/assets/podcasts.json";

// check if the 'database' has been created yet
if (!existsSync(podcastPath)) {
  // create new 'database' file if none exists
  appendFileSync(podcastPath, '{\n"podcasts":\n{\n},\n"playlists":\n {\n}\n}');
}

// load JSON data into varaible from podcasts.json
data = JSON.parse(readFileSync(podcastPath, "utf8"));

// convert raw seconds to an H:M:S format
function secondsToHMS(seconds) {
  var measuredTime = new Date(null);
  measuredTime.setSeconds(seconds);
  return measuredTime.toISOString().substr(11, 8);
}

// get XML data from an RSS link
function getXML(url, isXML) {
  return new Promise(function (resolve, reject) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onload = () => {
      if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
        resolve(isXML ? xmlHttp.responseXML : xmlHttp.responseText);
      } else {
        notify("Failed getting RSS info on: " + url);
        reject(new Error("Failed to get RSS info."));
        removePodcast(url);
      }
    };
    xmlHttp.onerror = () => {
      notify("Failed resolving link: " + url, ERROR);
      reject(new Error("Invalid link " + url));
      removePodcast(url);
    };
    xmlHttp.open("GET", url);
    xmlHttp.send(null);
  });
}

// add a podcast to the JSON data
function addPodcast(link) {
  if (!data.podcasts.hasOwnProperty(link)) {
    data.podcasts[link] = {
      link: link,
      favorite: false,
    };
    writeFileSync(podcastPath, JSON.stringify(data, null, 4));
    notify("Added new Podcast! " + link);
    home();
  } else {
    notify("Podcast already added.", WARNING);
  }
}

function removePodcast(link) {
  if (data.podcasts.hasOwnProperty(link)) {
    delete data.podcasts[link];
    writeFileSync(podcastPath, JSON.stringify(data, null, 4));
    home();
    notify("Removed invalid link: " + link, WARNING);
  }
}

function addFavorite(link) {
  if (data.podcasts.hasOwnProperty(link)) {
    data.podcasts[link].favorite = true;
    writeFileSync(podcastPath, JSON.stringify(data, null, 4));
  }
}

function removeFavorite(link) {
  if (data.podcasts.hasOwnProperty(link)) {
    data.podcasts[link].favorite = false;
    writeFileSync(podcastPath, JSON.stringify(data, null, 4));
  }
}

function clearPodcasts() {
  let podcasts = document.getElementById("podcasts");
  // remove all inner html from the podcasts element, effectively removing all children elements.
  podcasts.className = "podcasts";
  podcasts.innerHTML =
    "<div id='loader'></div> <div id ='no-found'> <h1>No podcasts found.</h1> </div>";
}

function displayPodcast(podcastData, jsonData, podcastURL) {
  try {
    let podcasts = document.getElementById("podcasts");
    let title = podcastData
      .getElementsByTagName("image")[0]
      .getElementsByTagName("title")[0].textContent;
    let link = podcastData
      .getElementsByTagName("image")[0]
      .getElementsByTagName("link")[0].textContent;
    let url = podcastData
      .getElementsByTagName("image")[0]
      .getElementsByTagName("url")[0].textContent;
    let description = podcastData
      .getElementsByTagName("itunes:summary")[0]
      .textContent.replace(/<.+?>/g, "");

    let podcast = document.createElement("div");
    podcast.className = "podcast";
    podcasts.appendChild(podcast);

    let split = document.createElement("div");
    split.className = "split";
    podcast.appendChild(split);
    split.onclick = () => {
      displayFull(podcastURL);
    };

    let image = document.createElement("img");
    image.src = url;
    image.className = "podcast-image";
    split.appendChild(image);

    podcast.onmouseover = () => {
      podcast.style.backgroundColor = "var(--highlight-color)";
      image.style.borderRadius = "30%";
      podcast.style.borderBottomColor = "var(--accent-color1-variant)";
    };

    podcast.onmouseout = () => {
      podcast.style.backgroundColor = "var(--main-color)";
      image.style.borderRadius = "0";
      podcast.style.borderBottomColor = "var(--accent-color3)";
    };

    let afterDiv = document.createElement("div");
    afterDiv.className = "podcast-after";
    split.appendChild(afterDiv);

    let name = document.createElement("div");
    name.className = "podcast-title";
    name.innerHTML = title;
    afterDiv.appendChild(name);

    let desc = document.createElement("div");
    desc.className = "podcast-description";
    if (description.length >= 222) {
      description = description.substr(0, 217) + " (...)";
    }
    desc.innerHTML = description;
    afterDiv.appendChild(desc);

    let fave = document.createElement("i");
    if (jsonData.podcasts[podcastURL].favorite) {
      fave.className = "fas fa-heart favorite";
    } else {
      fave.className = "fas fa-heart";
    }

    fave.addEventListener("click", () => {
      if (fave.classList.value.includes("favorite")) {
        removeFavorite(podcastURL);
        fave.className = "fas fa-heart";
        notify(`Removed ${title} from favorites!`);
      } else {
        addFavorite(podcastURL);
        notify(`Added ${title} to favorites!`);
        fave.className = "fas fa-heart favorite";
      }
    });

    let buttons = document.createElement("div");
    buttons.className = "podcast-buttons";
    podcast.appendChild(buttons);

    let addHolder = document.createElement("div");
    addHolder.className = "add-pod-button";
    buttons.appendChild(addHolder);

    let add = document.createElement("i");
    add.className = "fas fa-plus";
    addHolder.appendChild(add);

    let faveHolder = document.createElement("div");
    faveHolder.className = "fave-button";
    buttons.appendChild(faveHolder);
    faveHolder.appendChild(fave);

    if (podcasts.childNodes.length > 3) {
      document.getElementById("loader").style.display = "none";
    }
  } catch (exception) {
    notify("Failed to load Podcast with link: " + podcastURL, ERROR);
  }
}

async function home() {
  if (!buttonSpam) {
    hideFloating();
    podcastsLoaded = false;
    buttonSpam = true;
    setTimeout(() => {
      buttonSpam = false;
    }, 800);
    let keyObj = Object.keys(data.podcasts);

    if (keyObj.length > 0) {
      clearPodcasts();
      document.getElementById("no-found").style.display = "none";
      for (const item of keyObj) {
        await getXML(data.podcasts[item].link, true).then((podcastData) => {
          displayPodcast(podcastData, data, data.podcasts[item].link);
        });
      }
      podcastsLoaded = true;
    }
  }
}

async function favorites() {
  hideFloating();
  if (!buttonSpam) {
    podcastsLoaded = false;
    buttonSpam = true;
    setTimeout(() => {
      buttonSpam = false;
    }, 800);
    let keyObj = Object.keys(data.podcasts);

    if (keyObj.length > 0) {
      clearPodcasts();
      document.getElementById("no-found").style.display = "none";
      for (const item of keyObj) {
        await getXML(data.podcasts[item].link, true).then((podcastData) => {
          if (data.podcasts[data.podcasts[item].link].favorite) {
            displayPodcast(podcastData, data, data.podcasts[item].link);
          }
        });
      }
      podcastsLoaded = true;
      if (podcasts.childNodes.length == 3) {
        let podcasts = document.getElementById("podcasts");
        // remove all inner html from the podcasts element, effectively removing all chilren elements.
        podcasts.className = "podcasts";
        podcasts.innerHTML =
          "<div id='loader'></div> <div id ='no-found'> <h1>No favorites found.</h1> </div>";
      }
    }
  }
}

function settings() {
  let podcasts = document.getElementById("podcasts");

  if (document.getElementById("podcasts").childNodes.length > 3) {
    document.getElementById("loader").style.display = "none";
  }
}

function seek(forward) {}

function playPause() {
  let mediaButton = document.getElementById("media-play-button");
  if (audioPlayer.paused) {
    audioPlayer.play();
    mediaButton.innerHTML = '<i class="fas fa-pause"></i>';
  } else {
    audioPlayer.pause();
    mediaButton.innerHTML = '<i class="fas fa-play"></i>';
  }
}

function setPlayer(name, mp3, image, episode) {
  let playerName = document.getElementById("player-title");
  let playerImage = document.getElementById("player-image");
  let playerHidden = document.getElementById("player-title-hidden");

  if (currentEpisode) {
    currentEpisode.className = "episode";
  }
  currentEpisode = episode;
  currentEpisode.className = "episode selected";

  audioPlayer.innerHTML = "";
  let newAudioSrc = document.createElement("source");
  newAudioSrc.src = currentEpisode.getAttribute("mp3");
  audioPlayer.appendChild(newAudioSrc);
  audioPlayer.load();

  document.getElementById("episode-player").style = "opacity: 100;";

  playerHidden.onmouseover = () => {
    playerName.style = `margin-left: -${name.length / 2}rem;`;
  };
  playerHidden.onmouseout = () => {
    playerName.style = `margin-left: 0px;`;
  };

  playerName.innerHTML = name;
  playerImage.src = image.src;
}

function displayFull(podcastUrl) {
  if (podcastsLoaded) {
    clearPodcasts();
    document.getElementById("no-found").style.display = "none";
    getXML(podcastUrl, true).then((podcastData) => {
      let podcasts = document.getElementById("podcasts");
      podcasts.className = "podcasts details";

      let title = podcastData.getElementsByTagName("title")[0].textContent;
      let author =
        "By " +
        podcastData.getElementsByTagName("itunes:author")[0].textContent;
      let link = podcastData.getElementsByTagName("link")[0].textContent;
      let url = podcastData
        .getElementsByTagName("image")[0]
        .getElementsByTagName("url")[0].textContent;
      let description = podcastData
        .getElementsByTagName("itunes:summary")[0]
        .textContent.replace(/<.+?>/g, "");

      let episodesData = Array.prototype.slice.call(
        podcastData.querySelectorAll("item")
      );

      let podcast = document.createElement("div");
      podcast.className = "podcast podcast2";
      podcasts.appendChild(podcast);

      let split = document.createElement("div");
      split.className = "split";
      podcast.appendChild(split);

      let image = document.createElement("img");
      image.src = url;
      image.className = "podcast-image2";
      split.appendChild(image);

      let afterDiv = document.createElement("div");
      afterDiv.className = "podcast-after";
      split.appendChild(afterDiv);

      let afterDiv2 = document.createElement("div");
      afterDiv2.className = "podcast-after2";
      afterDiv.appendChild(afterDiv2);

      let name = document.createElement("div");
      name.className = "podcast-title2";
      name.innerHTML = title;
      afterDiv2.appendChild(name);

      name.onclick = () => {
        shell.openExternal(link);
      };

      let podauthor = document.createElement("div");
      podauthor.className = "podcast-author";
      podauthor.innerHTML = author;
      afterDiv2.appendChild(podauthor);

      let desc = document.createElement("div");
      desc.className = "podcast-description2";
      desc.innerHTML = description;
      afterDiv.appendChild(desc);

      let episodes = document.createElement("div");
      episodes.className = "episodes";
      podcasts.appendChild(episodes);

      episodesData.reverse().forEach((ep) => {
        let currentEpisodeTitle = ep.getElementsByTagName("title")[0]
          .textContent;
        let currentEpisodeDesc;
        if (ep.getElementsByTagName("itunes:summary")[0] !== undefined) {
          currentEpisodeDesc = ep.getElementsByTagName("itunes:summary")[0]
            .textContent;
        } else if (ep.getElementsByTagName("description")[0] !== undefined) {
          currentEpisodeDesc = ep.getElementsByTagName("description")[0]
            .textContent;
        } else {
          currentEpisodeDesc = "?";
        }

        let currentEpisodeDate = ep.getElementsByTagName("pubDate")[0]
          .textContent;
        if (!currentEpisodeDate) {
          currentEpisodeDate = "?";
        }
        let currentDate = new Date(Date.parse(currentEpisodeDate));
        let dateString = `${currentDate.getDate()} ${
          MONTHS[currentDate.getMonth()]
        }, ${currentDate.getFullYear()}`;

        let currentEpisodeTime = ep.getElementsByTagName("itunes:duration")[0]
          .textContent;
        if (!currentEpisodeTime.includes(":")) {
          if (parseInt(currentEpisodeTime) < 60) {
            currentEpisodeTime = "0:" + currentEpisodeTime;
          } else {
            currentEpisodeTime = secondsToHMS(parseInt(currentEpisodeTime));
          }
        }
        if (currentEpisodeTime.startsWith("00:")) {
          currentEpisodeTime = currentEpisodeTime.substr(
            3,
            currentEpisodeTime.length
          );
        }

        let currentEpisodeURL = ep
          .getElementsByTagName("enclosure")[0]
          .getAttribute("url");
        let publishDate = ep.getElementsByTagName("pubDate")[0].textContent;
        let audioLink = ep
          .getElementsByTagName("enclosure")[0]
          .getAttribute("url").textContent;

        let episode = document.createElement("div");
        episode.className = "episode";
        episode.onclick = () => {
          setPlayer(currentEpisodeTitle, currentEpisodeURL, image, episode);
        };
        episode.setAttribute("mp3", currentEpisodeURL);
        episodes.appendChild(episode);

        let episodeFirst = document.createElement("div");
        episodeFirst.className = "episode-first";
        episode.appendChild(episodeFirst);

        let episodeName = document.createElement("div");
        episodeName.className = "episode-name";
        episodeName.innerHTML = currentEpisodeTitle;
        episodeFirst.appendChild(episodeName);

        let episodeSummary = document.createElement("div");
        episodeSummary.className = "episode-summary";
        episodeSummary.innerHTML = currentEpisodeDesc;
        episodeFirst.appendChild(episodeSummary);

        let episodeSecond = document.createElement("div");
        episodeSecond.className = "episode-second";
        episode.appendChild(episodeSecond);

        let episodeDate = document.createElement("div");
        episodeDate.className = "episode-date";
        episodeDate.innerHTML = dateString;
        episodeSecond.appendChild(episodeDate);

        let episodeTime = document.createElement("div");
        episodeTime.className = "episode-time";
        episodeTime.innerHTML = currentEpisodeTime;
        episodeSecond.appendChild(episodeTime);
      });

      if (podcasts.childNodes.length > 3) {
        document.getElementById("loader").style.display = "none";
      }
    });
  }
}

function addLinkFromPlaylist() {
  let input = document.getElementsByClassName("add-input")[0];
  let inputLink = input.getElementsByTagName("input")[0];

  if (inputLink.value !== "" && inputLink.value !== undefined) {
    addPodcast(inputLink.value);
    hideFloating();
  } else {
    notify("You need to use a valid RSS link!", "info");
  }
}

function addNew() {
  let input = document.getElementsByClassName("add-input")[0];
  if (input.style.visibility == "hidden") {
    input.style.opacity = "100";
    input.style.visibility = "visible";
  } else {
    hideFloating();
  }
}

function hideFloating() {
  // TODO: Add other floating menus when they're written
  let input = document.getElementsByClassName("add-input")[0];
  input.getElementsByTagName("input")[0].value = "";
  input.style.opacity = "0";
  input.style.visibility = "hidden";
}

function notify(msg, typ) {
  if (notificationsLocal.length > 0 || notificationCurrent != undefined) {
    notificationsLocal.push({
      message: msg,
      type: typ,
    });
  } else {
    notificationCurrent = {
      message: msg,
      type: typ,
    };
    displayNotification();
  }
}

function displayNotification() {
  if (notificationCurrent != undefined) {
    let notifications = document.getElementsByClassName("notifications")[0];

    let notification = document.createElement("div");
    notification.className = "notification nothidden";

    let notificationType = document.createElement("div");
    notificationType.className = "notification-type";
    notification.appendChild(notificationType);

    let notificationText = document.createElement("div");
    notificationText.className = "notification-text";
    notificationText.innerHTML = notificationCurrent.message;
    notification.appendChild(notificationText);

    notifications.appendChild(notification);

    if (notificationCurrent.type === "error") {
      notificationType.className = "notification-type error";
      notificationType.innerHTML = '<i class="fas fa-bug"></i>';
    } else if (notificationCurrent.type === "warning") {
      notificationType.className = "notification-type warning";
      notificationType.innerHTML =
        '<i class="fas fa-exclamation-triangle"></i>';
    } else {
      notificationType.className = "notification-type info";
      notificationType.innerHTML = '<i class="fas fa-info"></i>';
    }

    setTimeout(() => {
      notification.className = "notification hide";
      setTimeout(() => {
        notifications.removeChild(notification);
        notificationCurrent = notificationsLocal.shift();
        displayNotification();
      }, 1000);
    }, 3000);
  }
}

// ELECTRON STUFF

// all links clicked open in default browser
document.addEventListener("click", function (event) {
  if (event.target.tagName === "A" && event.target.href.startsWith("http")) {
    event.preventDefault();
    shell.openExternal(event.target.href);
  }
});

document.getElementById("minimize").addEventListener("click", () => {
  ipcRenderer.send("minimize-window");
});

document.getElementById("close").addEventListener("click", () => {
  ipcRenderer.send("close-window");
});

// Load homepage
home();
