import { ShaderChunk } from 'three'

// Original simple shader for non-animated blocks
export const BLOCK_VERTEX_SHADER = `
// Three.js already provides position and uv attributes
attribute vec3 color;

varying vec2 vUv;
varying vec3 vColor;

void main() {
  vUv = uv;
  vColor = color;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const BLOCK_FRAGMENT_SHADER = `
uniform sampler2D map;
varying vec2 vUv;
varying vec3 vColor;

void main() {
  vec4 texColor = texture2D(map, vUv);
  gl_FragColor = vec4(vColor * texColor.rgb, texColor.a);
}
`

// New shader for animated blocks
export const ANIMATED_BLOCK_VERTEX_SHADER = `
#include <common>
${ShaderChunk.logdepthbuf_pars_vertex}

uniform float animationFrameHeight;
uniform float animationFrameIndex;
uniform float animationInterpolationFrameIndex;
uniform float animationInterpolation;

attribute vec3 color;
varying vec2 vUv;
varying vec3 vColor;
varying float vAnimationInterpolation;

void main() {
  vUv = uv;
  vColor = color;
  vAnimationInterpolation = animationInterpolation;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

  ${ShaderChunk.logdepthbuf_vertex}
}
`

export const ANIMATED_BLOCK_FRAGMENT_SHADER = `
${ShaderChunk.logdepthbuf_pars_fragment}

uniform sampler2D map;
uniform float animationFrameHeight;
uniform float animationFrameIndex;
uniform float animationInterpolationFrameIndex;

varying vec2 vUv;
varying vec3 vColor;
varying float vAnimationInterpolation;

void main() {
  // Calculate UV coordinates for current frame
  vec2 currentFrameUv = vec2(vUv.x, animationFrameHeight * (vUv.y + animationFrameIndex));
  vec4 currentFrame = texture2D(map, currentFrameUv);

  // If interpolation is enabled, calculate UV for next frame and mix
  if (vAnimationInterpolation > 0.0) {
    vec2 nextFrameUv = vec2(vUv.x, animationFrameHeight * (vUv.y + animationInterpolationFrameIndex));
    vec4 nextFrame = texture2D(map, nextFrameUv);
    currentFrame = mix(currentFrame, nextFrame, vAnimationInterpolation);
  }

  gl_FragColor = vec4(vColor * currentFrame.rgb, currentFrame.a);

  ${ShaderChunk.logdepthbuf_fragment}
}
`
