import React, { Component } from 'react';
import './App.css';

class Post extends Component {
  render() {
    return (
      <div>
        <h2>{this.props.title}</h2>
        <p>/r/{this.props.subreddit}</p>
        <p>{this.props.numComments} Comment{this.props.numComments === 1 ? '' : 's'}</p>
        <p>Score: {this.props.score}</p>
      </div>
    );
  }
}

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      posts: [],
      user: undefined,
    };
  }

  componentDidMount() {
    fetch('http://localhost:8000/posts/')
      .then(response => {
        if (response.status !== 200) {
          return console.warn('Uh oh');
        }
        return response.json();
      })
      .then(data => this.setState({posts: data.posts}));
  }
  
  render() {
    return (
      <div>
        <h1>Reddit Clone</h1>
        <p>{this.state.user ? `Logged in as ${this.state.user}` : `Not logged in`}</p>
        {this.state.posts.map((post, idx) => {
          return (
            <Post
              title={post.title}
              subreddit={post.subreddit}
              score={post.score}
              numComments={post.numComments}
              key={idx}
            />
          );
        })}
      </div>
    );
  }
}

export default App;
