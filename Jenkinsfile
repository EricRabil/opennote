pipeline {
  agent {
    node {
      label 'master'
      customWorkspace '/var/onote/client'
    }
  }

  stages {
    stage('Clone Sources') {
      steps {
        git 'https://github.com/EricRabil/opennote.git'
      }
    }
    stage('Information') {
      steps {
        sh 'node -v'
        sh 'npm -v'
      }
    }
    stage('Dependencies') {
      steps {
        sh 'npm install'
      }
    }
    stage('Build') {
      steps {
        sh 'VUE_APP_BUILD_NUMBER=${env.BUILD_NUMBER} npm run build:dev'
      }
    }
    stage('Artifacts') {
      steps {
        sh 'tar -czf dist.tar.gz ./dist'
        archiveArtifacts artifacts: 'dist.tar.gz', fingerprint: true
      }
    }
  }
}