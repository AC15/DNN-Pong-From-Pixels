import VisualDQLController from './visual_dql_controller';

const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const canvasDownscaled = document.getElementById('canvasDownscaled');
const contextDownscaled = canvasDownscaled.getContext('2d');
const paddleHeight = 40;
const paddleWidth = 8;
const paddleSpeed = 3;
const paddleInitialY = canvas.height / 2 - paddleHeight / 2;
const ballRadius = 4;
const ballSpeed = 2.5;
const ballSpeedIncrement = 0.2;
const aiHandicap = 0.05;
const fps = 25;
const showScore = false;
const resizeFactor = 0.1;
let hasMatchEnded = false;
let skipFrame = false;
let leftController = new VisualDQLController('left');
let currentFrame = 0;
let controllerFrameInterval = 5; // 25 FPS / 5 = 5 updates per second
let upKeyPressed = false;
let downKeyPressed = false;
let matchCounter = 0;

const player = {
  x: paddleWidth,
  y: paddleInitialY,
  width: paddleWidth,
  height: paddleHeight,
  direction: 1,
  score: 0,
  isWinner: false,
};

const ai = {
  x: canvas.width - paddleWidth * 2,
  y: paddleInitialY,
  width: paddleWidth,
  height: paddleHeight,
  direction: -1,
  score: 0,
  isWinner: false,
};

const ball = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  radius: ballRadius,
  speed: ballSpeed,
  velocityX: player.direction * ballSpeed * Math.cos(Math.PI / 4),
  velocityY: ballSpeed * Math.sin(Math.PI / 4),
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

function display() {
  context.fillStyle = '#000';
  displayBackground();
  context.fillStyle = '#fff';
  displayLine();
  if (showScore) {
    displayScore(canvas.width / 4, canvas.height / 4, player.score);
    displayScore(3 * (canvas.width / 4) - 35, canvas.height / 4, ai.score);
  }
  displayPaddle(player);
  displayPaddle(ai);
  displayBall();
}

function newGame() {
  player.score = 0;
  player.y = paddleInitialY;
  ai.y = paddleInitialY;
  ai.score = 0;
}

function newRound(loserPaddle, winnerPaddle) {
  winnerPaddle.score++;

  newGame();
  hasMatchEnded = true;
  loserPaddle.isWinner = false;
  winnerPaddle.isWinner = true;

  ball.x = canvas.width / 2;
  ball.y = canvas.height / 2;
  ball.speed = ballSpeed;
  ball.velocityX *= -1;
  ball.velocityY *= -1;
}

function collisionDetection(paddle, ball) {
  paddle.top = paddle.y;
  paddle.right = paddle.x + paddle.width;
  paddle.bottom = paddle.y + paddle.height;
  paddle.left = paddle.x;

  ball.top = ball.y - ball.radius;
  ball.right = ball.x + ball.radius;
  ball.bottom = ball.y + ball.radius;
  ball.left = ball.x - ball.radius;

  return ball.left < paddle.right && ball.top < paddle.bottom && ball.right > paddle.left && ball.bottom > paddle.top;
}

let state = {};

async function playerMovement() {
  state = {
    winner: getWinner(),
    imageData: getPixels(),
  };

  if (state.winner || (state.imageData && currentFrame % controllerFrameInterval === 0)) {
    switch (await leftController.selectAction(state)) {
      case -1:
        upKeyPressed = true;
        downKeyPressed = false;
        break;
      case 0:
        upKeyPressed = false;
        downKeyPressed = false;
        break;
      case 1:
        upKeyPressed = false;
        downKeyPressed = true;
        break;
    }
  }

  if (upKeyPressed && player.y > 0) {
    player.y -= paddleSpeed;
  } else if (downKeyPressed && player.y < canvas.height - player.height) {
    player.y += paddleSpeed;
  }
}

function getWinner() {
  if (ball.x + ball.radius >= canvas.width) {
    return 'left';
  } else if (ball.x - ball.radius <= 0) {
    return 'right';
  }
}

function moveAiPaddle() {
  ai.y += (ball.y - (ai.y + ai.height / 2)) * aiHandicap;
}

function ballCollision() {
  // Top/bottom ball collision
  if (ball.y + ball.radius >= canvas.height || ball.y - ball.radius <= 0) {
    ball.velocityY *= -1;
  }

  // Left/right ball collision
  if (ball.x + ball.radius >= canvas.width) {
    newRound(ai, player);
  } else if (ball.x - ball.radius <= 0) {
    newRound(player, ai);
  }

  ball.x += ball.velocityX;
  ball.y += ball.velocityY;
}

function paddleCollision() {
  let paddle = ball.x < canvas.width / 2 ? player : ai;

  if (collisionDetection(paddle, ball)) {
    let angle = 0;

    if (ball.y < paddle.y + paddle.height / 2) {
      angle = -Math.PI / 4; // -45deg
    } else if (ball.y > paddle.y + paddle.height / 2) {
      angle = Math.PI / 4; // 45deg
    }

    ball.velocityX = paddle.direction * ball.speed * Math.cos(angle);
    ball.velocityY = ball.speed * Math.sin(angle);
    ball.speed += ballSpeedIncrement;
  }
}

async function update() {
  playerMovement();
  ballCollision();
  moveAiPaddle();
  paddleCollision();
  display();

  currentFrame += 1;

  if (skipFrame) {
    drawResizedCanvas();
  }

  skipFrame = !skipFrame;
}

function drawResizedCanvas() {
  const resizeWidth = canvas.width * resizeFactor;
  const resizeHeight = canvas.height * resizeFactor;

  createImageBitmap(canvas, {
    resizeWidth: resizeWidth,
    resizeHeight: resizeHeight,
    resizeQuality: 'high',
  }).then((imageBitmap) => contextDownscaled.drawImage(imageBitmap, 0, 0));

  canvasDownscaled.width = resizeWidth;
  canvasDownscaled.height = resizeHeight;
}

function getPixels() {
  // raw RGBA pixel data
  const rawPixels = contextDownscaled.getImageData(0, 0, canvasDownscaled.width, canvasDownscaled.height).data;
  const width = canvasDownscaled.width;
  const height = canvasDownscaled.height;

  if (!canvasDownscaled.width || canvasDownscaled.width === 300) {
    return;
  }

  // pixels that are either white (true) or black (false)
  const binaryPixels = new Array(width);
  for (let i = 0; i < width; i++) {
    binaryPixels[i] = new Array(height);
  }

  let x = 0;
  let y = 0;
  for (let i = 0; i < rawPixels.length; i += 4) {
    binaryPixels[x][y] = rawPixels[i] > 0 ? 1 : 0;

    x += 1;
    if (x >= width) {
      x = 0;
      y += 1;
    }
  }

  return binaryPixels;
}

function roundStart() {
  $(document).ready(async () => {
    let isUpdating = false;
    let error = null;

    const updateInterval = setInterval(() => {
      if (isUpdating) {
        return;
      }

      isUpdating = true;

      update()
        .then(() => {
          isUpdating = false;
        })
        .catch((e) => {
          error = e;
          console.error(e);
        })
        .finally(() => {
          // Check if the match is finished or there was an error
          if (error) {
            clearInterval(updateInterval);
            reject(error);
          } else if (hasMatchEnded) {
            matchCounter++;
            console.info(`Match ${matchCounter} has Ended`);
            hasMatchEnded = false;
            clearInterval(updateInterval);
            leftController.onMatchEnd(player.isWinner); // right controller doesn't exist
            roundStart();
          }
        });
    }, 1000 / fps);
  });
}

roundStart();
