const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const paddleHeight = 45;
const paddleWidth = 10;

const player = {
  x: paddleWidth,
  y: canvas.height / 2 - paddleHeight / 2,
  width: paddleWidth,
  height: paddleHeight,
  score: 0,
};

const ai = {
  x: canvas.width - paddleWidth * 2,
  y: canvas.height / 2 - paddleHeight / 2,
  width: paddleWidth,
  height: paddleHeight,
  score: 0,
};

const ball = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  radius: 5,
  speed: 7,
  velocityX: 5,
  velocityY: 5,
};

function displayBackground() {
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function displayLine() {
  context.fillRect(canvas.width / 2 - 0.5, 0, 1, canvas.height);
}

function displayScore(x, y, score) {
  context.font = '80px Arial';
  context.fillText(score, x, y);
}

function displayPaddle(paddle) {
  context.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
}

function displayBall() {
  context.fillRect(ball.x - ball.radius, ball.y - ball.radius, ball.radius * 2, ball.radius * 2);
}

context.fillStyle = '#000';
displayBackground();
context.fillStyle = '#fff';
displayLine();
displayScore(canvas.width / 4, canvas.height / 4, player.score);
displayScore(3 * (canvas.width / 4) - 35, canvas.height / 4, ai.score);
displayPaddle(player);
displayPaddle(ai);
displayBall();
