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

// A visual deep Q-learning controller that learns while playing.

import * as tf from '@tensorflow/tfjs';

import BaseController from './base_controller';
import ReplayMemory from './replay_memory';
import VisualDQN from './visual_dqn';

import _ from 'lodash';

export default class VisualDQLController extends BaseController {
  constructor(leftOrRight, options) {
    options = {
      gamma: 0.99,
      trainingSetMinSize: 20,
      trainingSetMaxSize: 200,
      trainingEpochs: 1,
      trainingIterations: 4,
      lr: 0.001,
      lrDecay: 0.99,
      epsilonInit: 0.5,
      epsilonDecay: 0.95,
      verbose: false,
      ...(options || {}),
    };
    options.modelOptions = {
      inputWidth: 210 / 10,
      inputHeight: 160 / 10,
      nConvLayers: 2,
      kernelSize: 3,
      nFilters: 30,
      maxPoolingSize: 2,
      nDenseLayers: 1,
      nHiddenUnits: 30,
      dropout: 0.1,
      ...(options.dqnOptions || {}),
    };
    options.memoryOptions = {
      capacity: 3000,
      ...(options.memoryOptions || {}),
    };
    super(leftOrRight, options);

    this.replayMemory = this.replayMemory || new ReplayMemory(options.memoryOptions);
    this.model = this.model || new VisualDQN(options.modelOptions);

    this.previousState = null;
    this.previousAction = null;
    this.epsilon = this.epsilonInit;

    this.isVisual = true;
    this.timestamp = new Date();
  }

  // Return the reward for the given state. Simple: +1 when we win, -1 when we lose.
  getReward(state) {
    if (state.winner === this.leftOrRight) return 1;
    else if (state.winner != null) return -1;
    else return 0;
  }

  // Convert a state to a tensor to be used as input to the DQN model.
  // Contains the current image as a 2D array.
  stateToTensor(s, side) {
    // Convert a state to a raw array
    side = side || this.leftOrRight;

    return tf.tidy(() => {
      let imageData = tf.tensor(s.imageData);
      let previous = s.previousImageData;
      if (previous) {
        previous = tf.tensor(previous);
      } else {
        previous = tf.zerosLike(imageData);
      }

      // Subtract the previous image, multiplied by 0.5
      // This makes sure some information about movement is included.
      previous = tf.mul(previous, 0.5);

      imageData = tf.sub(imageData, previous);

      if (side === 'right') {
        // Mirror features
        imageData = tf.reverse2d(imageData, 0);
      }

      // const max = tf.max(imageData).arraySync()[0];
      // if (max > 1) imageData = tf.div(imageData, max);

      return imageData.expandDims(-1);
    });
  }

  // Given a batch of transitions, converts them to an x tensor.
  async transitionsToX(transitions) {
    const states = transitions.map((t) => this.stateToTensor(t.state, t.side));
    return tf.stack(states);
  }

  // Given a batch of transitions, returns a y tensor of target values.
  async transitionsToY(transitions) {
    // Get the expected reward for each transition
    const expectedStateActionValues = Array(transitions.length);

    // Pre-fill with "NaNs". We use -10 as a NaN value, which will be filtered out in the loss function.
    const stateExpectationsTensor = tf.mul(tf.ones([transitions.length, 3]), -10);

    // Estimate Q values for resulting states:
    const newStateExpectationsTensor = tf.tidy(() => {
      const newStates = tf.stack(transitions.map((t) => this.stateToTensor(t.newState, t.side)));
      return this.model.predict(newStates);
    });

    // Wait for the computations to be done:
    const [stateExpectations, newStateExpectations] = await Promise.all([
      stateExpectationsTensor.array(),
      newStateExpectationsTensor.array(),
    ]);

    tf.dispose([stateExpectationsTensor, newStateExpectationsTensor]);

    for (let i = 0; i < transitions.length; i++) {
      const transition = transitions[i];

      // Bootstrap the target Q values
      const directReward = transition.reward;
      const winner = transition.newState && transition.newState.winner;
      expectedStateActionValues[i] = stateExpectations[i];
      const actionIndex = [-1, 0, 1].indexOf(transition.action);
      const nextStateQ = winner ? 0 : Math.max(...newStateExpectations[i]);
      const target = directReward + this.gamma * nextStateQ;
      expectedStateActionValues[i][actionIndex] = Math.max(-1, Math.min(target, 1));
    }

    return tf.tensor(expectedStateActionValues);
  }

  // Select action given state
  async selectAction(state) {
    if (this.previousState) {
      const reward = this.getReward(state);
      // Remember this transition so we can learn from it:
      this.replayMemory.push(this.leftOrRight, this.previousState, this.previousAction, state, reward);
    }

    // Let the model pick the next action
    let action = 0;

    if (Math.random() < this.epsilon) {
      // Random action:
      if (Math.random() < 0.5) action = -1;
      else action = 1;
    } else {
      // Sample from model predictions:
      const temperature = 0.1 + 2 * this.epsilon;
      action = await this.model.sampleAction(this.stateToTensor(state), temperature);
    }

    this.previousState = state;
    this.previousAction = action;

    return action;
  }

  // Train the model
  async trainModel() {
    // Training set should not be bigger than our replay memory:
    const trainingSetSize = Math.round(Math.min(this.replayMemory.memory.length, this.trainingSetMaxSize));

    // Let's not train if we didn't collect enough examples yet:
    if (trainingSetSize < this.trainingSetMinSize) return;

    // Train the model
    return new Promise((resolve, reject) => {
      const trainingSet = this.replayMemory.sample(trainingSetSize);

      Promise.all([this.transitionsToX(trainingSet), this.transitionsToY(trainingSet)]).then(([x, y]) => {
        if (this.verbose) {
          const average = (data) => data.reduce((sum, value) => sum + value) / data.length;
          const standardDeviation = (values) => Math.sqrt(average(values.map((value) => (value - average(values)) ** 2)));

          const p = this.model.predict(x, true);
          const e = tf.abs(tf.sub(y, p));

          const describe = (x) => {
            return {
              min: tf.min(x).arraySync(),
              max: tf.max(x).arraySync(),
              mean: tf.mean(x).arraySync(),
              std: standardDeviation(_.flatten(x.arraySync())),
            };
          };

          console.table({
            y: describe(y),
            p: describe(p),
            e: describe(e),
          });
        }

        this.model
          .fit(x, y, { epochs: this.trainingEpochs })
          .then(resolve)
          .catch(reject)
          .finally(() => {
            // Clear tensors from memory:
            tf.dispose([x, y]);
          });
      });
    });
  }

  async onMatchEnd(won) {
    this.previousState = null;
    this.previousAction = null;

    // Train model a few times since the default values get updated in each step
    this.model.setLearningRate(this.lr);
    for (let i = 0; i < this.trainingIterations; i++) {
      tf.engine().startScope();
      await this.trainModel();
      tf.engine().endScope();
    }

    await this.model.model.save(`localstorage://${this.timestamp.toISOString()}-dqn-pong-model`);

    console.info(tf.memory());

    // Decay learning rate and epsilon:
    this.lr *= this.lrDecay;
    this.epsilon *= this.epsilonDecay;
  }
}
