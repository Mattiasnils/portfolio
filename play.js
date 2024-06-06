const Placeholders = document.querySelectorAll(".placeholder");
const playButtons = document.querySelectorAll(".play-button");
const projectCards = document.querySelectorAll(".project-card-content");
const projects = [42854414, 117240994, 80322642, 26693568, 10126059, 2948727];
console.log(playButtons);

// Add an event listener for the click event on each play button
playButtons.forEach((playButton) => {
  playButton.addEventListener("click", () => {
    this.blur();

    // Get the index of the current play button
    console.log(playButton);
    const index = playButton.dataset.id;

    // Get the placeholder and project card for the current instance
    const placeholder = Placeholders[index];
    const projectCard = projectCards[index];

    // Create the the game iframe and replace the placeholder
    const iframe = document.createElement("iframe");

    iframe.src = `https://turbowarp.org/${projects[index]}/embed?addons=pause`;
    iframe.width = "485";
    iframe.height = "482";
    iframe.allowFullscreen = true;
    iframe.setAttribute("scrolling", "no");
    iframe.setAttribute("allowtransparency", "true");

    projectCard.replaceChild(iframe, placeholder);
  });
});
