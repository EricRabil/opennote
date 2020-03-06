pipeline {
  agent {
    docker {
      image 'node'
    }
  }
  environment {
    HOME= '.'
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
        sh 'npm run build'
      }
    }
    stage('Artifacts') {
      steps {
        sh 'tar -czf dist.tar.gz ./dist'
        stash 'dist.tar.gz'
        archiveArtifacts artifacts: 'dist.tar.gz', fingerprint: true
      }
    }
    stage('Deploy!') {
      agent {
        node {
          label 'opennote-client'
          customWorkspace '/var/onote/client'
        }
      }
      steps {
        unstash 'dist.tar.gz'
        sh 'tar -xzf dist.tar.gz'
      }
    }
  }
}