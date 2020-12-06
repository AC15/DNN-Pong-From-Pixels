// MIT License

// Copyright (c) 2019 Max

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// Source: https://github.com/cpury/pong-rl/

// Defines an abstract base controller

// eslint-disable-next-line no-unused-vars
export default class BaseController {
  constructor(leftOrRight, options) {
    this.leftOrRight = leftOrRight;
    this.options = options;
    Object.assign(this, options);

    // Set this to true if you require image information in your states
    this.isVisual = false;
  }

  // Create a mirrored controller of this controller for self-play.
  // For RL agents, make sure this also links the underlying models.
  mirrorController(options) {
    let leftOrRight = 'right';
    if (this.leftOrRight === 'right') this.leftOrRight = 'left';
    options = {
      ...this.options,
      ...(options || {}),
    };
    return new this.constructor(leftOrRight, options);
  }

  // Given the current game state, should return
  // 1 (down), -1 (up) or 0 (nothing)
  // eslint-disable-next-line no-unused-vars
  async selectAction(state) {}

  // Called when the match ends. Won is whether this player won or not.
  // eslint-disable-next-line no-unused-vars
  async onMatchEnd(won) {}
}
