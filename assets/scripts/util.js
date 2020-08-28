const {
  existsSync,
  appendFileSync,
  readFileSync,
  writeFileSync
} = require("fs");
const {
  format
} = require("path");
const dataPath = "podcasts.json";
let maximized = false;
let buttonSpam = false;
let podcastsLoaded = false;

const WARNING = "warn";
const ERROR = "error";

let backArrow = [];
let notificationsLocal = [];
let notificationCurrent;

// check if the 'database' has been created yet
if (!existsSync(dataPath)) {
  appendFileSync(dataPath, '{\n"podcasts":\n{\n},\n"playlists":\n {\n}\n}');
}

let data = JSON.parse(readFileSync(dataPath, "utf8"));

// window control buttons
const remote = require("electron").remote;
let electronWindow = remote.getCurrentWindow();

let shell = require("electron").shell;

// all links open external
document.addEventListener('click', function (event) {
  if (event.target.tagName === 'A' && event.target.href.startsWith('http')) {
    event.preventDefault()
    shell.openExternal(event.target.href)
  }
})

document.getElementById("minimize").addEventListener("click", () => {
  electronWindow.minimize();
});

document.getElementById("close").addEventListener("click", () => {
  electronWindow.close();
});

function formatTime(rawSeconds) {
  var measuredTime = new Date(null);
  measuredTime.setSeconds(rawSeconds);
  return measuredTime.toISOString().substr(11, 8);
}

function testLink(url, isXML) {
  return new Promise(function (resolve, reject) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onload = () => {
      if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
        resolve();
      } else {
        reject(new Error("Failed to get rss info."));
      }
    };
    xmlHttp.onerror = () => {
      reject(new Error("Invalid link " + url));
    };
    xmlHttp.open("GET", url);
    xmlHttp.send(null);
  });
}

function get(url, isXML) {
  return new Promise(function (resolve, reject) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onload = () => {
      if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
        resolve(isXML ? xmlHttp.responseXML : xmlHttp.responseText);
      } else {
        notify("Failed getting rss info on: " + url);
        reject(new Error("Failed to get rss info."));
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

function getPodcasts() {
  data = JSON.parse(readFileSync(dataPath, "utf8"));
  return data;
}

function addPodcast(link) {
  if (link.startsWith("https://") || link.startsWith("http://")) {
    if (!data.podcasts.hasOwnProperty(link)) {
      data.podcasts[link] = {
        link: link,
        favorite: false
      };
      writeFileSync(dataPath, JSON.stringify(data, null, 4));
      notify("Added new Podcast!");
      home();
    }
  } else {
    link = "http://" + link;
    testPromise = testLink(link, true);
    testPromise.catch(error => {
      notify("Failed to verify as valid link: " + link);
    });

    testPromise.then(() => {
      addPodcast(link);
    });
  }
}

function removePodcast(link) {
  if (data.podcasts.hasOwnProperty(link)) {
    delete data.podcasts[link];
    writeFileSync(dataPath, JSON.stringify(data, null, 4));
    home();
    notify("Removed invalid link: " + link, WARNING);
  }
}

function addFavorite(link) {
  if (data.podcasts.hasOwnProperty(link)) {
    data.podcasts[link].favorite = true;
    writeFileSync(dataPath, JSON.stringify(data, null, 4));
  }
}

function removeFavorite(link) {
  if (data.podcasts.hasOwnProperty(link)) {
    data.podcasts[link].favorite = false;
    writeFileSync(dataPath, JSON.stringify(data, null, 4));
  }
}

function getPodcastData(podcastData) {}

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
    let description = podcastData.getElementsByTagName("itunes:summary")[0]
      .textContent.replace(/<.+?>/g, "");

    let podcast = document.createElement("div");
    podcast.className = "podcast";
    podcasts.appendChild(podcast);

    let split = document.createElement("div");
    split.className = "split";
    podcast.appendChild(split);
    split.onclick = () => {
      displayPodcastDetails(podcastURL);
    };

    let image = document.createElement("img");
    image.src = url;
    image.className = "podcast-image";
    split.appendChild(image);

    podcast.onmouseover = () => {
      podcast.style.backgroundColor = "#212121";
      image.style.borderRadius = "30%";
    };

    podcast.onmouseout = () => {
      podcast.style.backgroundColor = "#1b1b1b";
      image.style.borderRadius = "0";
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
    let podcasts = document.getElementById("podcasts");

    let podcast = document.createElement("div");
    podcast.className = "podcast";
    podcasts.appendChild(podcast);

    let split = document.createElement("div");
    split.className = "split";
    podcast.appendChild(split);
    split.onclick = () => {
      displayPodcastDetails(podcastURL);
    };

    podcast.onmouseover = () => {
      podcast.style.backgroundColor = "#212121";
    };

    podcast.onmouseout = () => {
      podcast.style.backgroundColor = "#1b1b1b";
    };

    let afterDiv = document.createElement("div");
    afterDiv.className = "podcast-after";
    split.appendChild(afterDiv);

    let name = document.createElement("div");
    name.className = "podcast-title";
    name.innerHTML = podcastURL;
    afterDiv.appendChild(name);

    let desc = document.createElement("div");
    desc.className = "podcast-description";
    desc.innerHTML =
      "Error! Couldn't load info on this podcast, make sure the URL is correct!";
    afterDiv.appendChild(desc);

    let buttons = document.createElement("div");
    buttons.className = "podcast-buttons";
    podcast.appendChild(buttons);

    if (podcasts.childNodes.length > 3) {
      document.getElementById("loader").style.display = "none";
    }
  }
}

function clearPodcasts() {
  let podcasts = document.getElementById("podcasts");
  // remove all inner html from the podcasts element, effectively removing all chilren elements.
  podcasts.className = "podcasts";
  podcasts.innerHTML =
    "<div id='loader'></div> <div id ='no-found'> <h1>No podcasts found.</h1> </div>";
}

async function home() {
  hideAddPlaylist();
  if (!buttonSpam) {
    podcastsLoaded = false;
    buttonSpam = true;
    setTimeout(() => {
      buttonSpam = false;
    }, 800);
    let data = getPodcasts();
    let keyObj = Object.keys(data.podcasts);

    if (keyObj.length > 0) {
      clearPodcasts();
      document.getElementById("no-found").style.display = "none";
      for (const item of keyObj) {
        await get(data.podcasts[item].link, true).then(podcastData => {
          displayPodcast(podcastData, data, data.podcasts[item].link);
        });
      }
      podcastsLoaded = true;
    }
  }
}

async function favorites() {
  hideAddPlaylist();
  if (!buttonSpam) {
    podcastsLoaded = false;
    buttonSpam = true;
    setTimeout(() => {
      buttonSpam = false;
    }, 800);
    let data = getPodcasts();
    let keyObj = Object.keys(data.podcasts);

    if (keyObj.length > 0) {
      clearPodcasts();
      document.getElementById("no-found").style.display = "none";
      for (const item of keyObj) {
        await get(data.podcasts[item].link, true).then(podcastData => {
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

function displayPodcastDetails(podcastUrl) {
  if (podcastsLoaded) {
    clearPodcasts();
    document.getElementById("no-found").style.display = "none";
    get(podcastUrl, true).then(podcastData => {
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
      let description = podcastData.getElementsByTagName("itunes:summary")[0]
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

      episodesData.reverse().forEach(ep => {
        let currentEpisodeTitle = ep.getElementsByTagName("title")[0]
          .textContent;
        let currentEpisodeDesc
        if (ep.getElementsByTagName("itunes:summary")[0] !== undefined) {
          currentEpisodeDesc = ep.getElementsByTagName("itunes:summary")[0].textContent;
        } else if (ep.getElementsByTagName("description")[0] !== undefined) {
          currentEpisodeDesc = ep.getElementsByTagName("description")[0].textContent;

        } else {
          currentEpisodeDesc = "?";
        }


        let currentEpisodeTime = ep.getElementsByTagName("itunes:duration")[0].textContent;
        if (!currentEpisodeTime.includes(":")) {
          if (parseInt(currentEpisodeTime) < 60) {
            currentEpisodeTime = "0:" + currentEpisodeTime;
          } else {
            currentEpisodeTime = formatTime(parseInt(currentEpisodeTime));
          }
        }
        if (currentEpisodeTime.startsWith("00:")) {
          currentEpisodeTime = currentEpisodeTime.substr(3, currentEpisodeTime.length);
        }

        let currentEpisodeURL = ep
          .getElementsByTagName("enclosure")[0]
          .getAttribute("url");
        let publishDate = ep.getElementsByTagName("pubDate")[0].textContent;
        let audioLink = ep.getElementsByTagName("enclosure")[0].getAttribute("url").textContent;

        let episode = document.createElement("div");
        episode.className = "episode";
        episode.setAttribute("mp3", currentEpisodeURL);
        episodes.appendChild(episode);

        let episodeName = document.createElement("div");
        episodeName.className = "episode-name";
        episodeName.innerHTML = currentEpisodeTitle;
        episode.appendChild(episodeName);

        let episodeTime = document.createElement("div");
        episodeTime.className = "episode-time";
        episodeTime.innerHTML = currentEpisodeTime;
        episode.appendChild(episodeTime);
      });

      if (podcasts.childNodes.length > 3) {
        document.getElementById("loader").style.display = "none";
      }
    });
  }
}

function addPlayEvent(evnt) {
  if (evnt.key == "Enter") {
    addLinkFromPlaylist();
  }
}

function addLinkFromPlaylist() {
  let input = document.getElementsByClassName("add-input")[0];
  let inputLink = input.getElementsByTagName("input")[0];

  if (inputLink.value !== "" && inputLink.value !== undefined) {
    addPodcast(inputLink.value);
    hideAddPlaylist();
  } else {
    notify("You need to use a valid RSS link!", "info");
  }
}

function addPlaylist() {
  let input = document.getElementsByClassName("add-input")[0];
  if (input.style.visibility == "hidden") {
    input.style.opacity = "100";
    input.style.visibility = "visible";
  } else {
    hideAddPlaylist();
  }
}

function hideAddPlaylist() {
  let input = document.getElementsByClassName("add-input")[0];
  input.getElementsByTagName("input")[0].value = "";
  input.style.opacity = "0";
  input.style.visibility = "hidden";
}

function notify(msg, typ) {
  if (notificationsLocal.length > 0 || notificationCurrent != undefined) {
    notificationsLocal.push({
      message: msg,
      type: typ
    });
  } else {
    notificationCurrent = {
      message: msg,
      type: typ
    };
    displayNotifications();
  }
}

function displayNotifications() {
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
        displayNotifications();
      }, 1000);
    }, 3000);
  }
}

home();
